// package.json
{
  "name": "hackathon-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "express": "^4.18.2",
    "prisma": "^5.7.1",
    "@prisma/client": "^5.7.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.7",
    "node-cron": "^3.0.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "socket.io": "^4.7.4",
    "joi": "^17.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}

// .env
DATABASE_URL="postgresql://username:password@localhost:5432/hackathon_db"
JWT_SECRET="your-super-secret-jwt-key"
EMAIL_USER="your-gmail@gmail.com"
EMAIL_PASS="your-app-password"
PORT=5000

// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(uuid())
  name          String
  email         String         @unique
  password      String
  skills        String[]
  createdAt     DateTime       @default(now())
  registrations Registration[]
  teamMembers   TeamMember[]

  @@map("users")
}

model Hackathon {
  id                   String         @id @default(uuid())
  title                String
  description          String
  registrationDeadline DateTime
  startDate            DateTime
  endDate              DateTime
  isActive             Boolean        @default(true)
  problemStatements    String[]
  maxTeamSize          Int            @default(3)
  createdAt            DateTime       @default(now())
  registrations        Registration[]
  teams                Team[]

  @@map("hackathons")
}

model Registration {
  id          String    @id @default(uuid())
  userId      String
  hackathonId String
  createdAt   DateTime  @default(now())
  user        User      @relation(fields: [userId], references: [id])
  hackathon   Hackathon @relation(fields: [hackathonId], references: [id])

  @@unique([userId, hackathonId])
  @@map("registrations")
}

model Team {
  id                String       @id @default(uuid())
  hackathonId       String
  problemStatement  String
  createdAt         DateTime     @default(now())
  hackathon         Hackathon    @relation(fields: [hackathonId], references: [id])
  members           TeamMember[]

  @@map("teams")
}

model TeamMember {
  id     String @id @default(uuid())
  teamId String
  userId String
  team   Team   @relation(fields: [teamId], references: [id])
  user   User   @relation(fields: [userId], references: [id])

  @@unique([teamId, userId])
  @@map("team_members")
}

// server.js
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import hackathonRoutes from './routes/hackathon.js';
import teamRoutes from './routes/team.js';
import { startScheduler } from './utils/scheduler.js';
import { authenticateToken } from './middleware/auth.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Make io available in routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/hackathons', hackathonRoutes);
app.use('/api/teams', teamRoutes);

// WebSocket connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-hackathon', (hackathonId) => {
    socket.join(hackathonId);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start scheduler for automatic team formation
startScheduler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// middleware/auth.js
import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

const registerSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  skills: Joi.array().items(Joi.string()).default([])
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Register user
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email, password, skills } = value;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        skills
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        skills: user.skills
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        skills: user.skills
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

// routes/hackathon.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const registerHackathonSchema = Joi.object({
  hackathonId: Joi.string().required()
});

// Get all active hackathons
router.get('/', async (req, res) => {
  try {
    const hackathons = await prisma.hackathon.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { registrations: true }
        }
      }
    });

    res.json(hackathons);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get hackathon by ID
router.get('/:id', async (req, res) => {
  try {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { registrations: true }
        }
      }
    });

    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    res.json(hackathon);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Register for hackathon
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { error, value } = registerHackathonSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { hackathonId } = value;
    const userId = req.user.userId;

    // Check if hackathon exists and is active
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: hackathonId }
    });

    if (!hackathon || !hackathon.isActive) {
      return res.status(400).json({ error: 'Hackathon not found or inactive' });
    }

    // Check if registration is still open
    if (new Date() > hackathon.registrationDeadline) {
      return res.status(400).json({ error: 'Registration deadline passed' });
    }

    // Check if already registered
    const existingRegistration = await prisma.registration.findUnique({
      where: {
        userId_hackathonId: {
          userId,
          hackathonId
        }
      }
    });

    if (existingRegistration) {
      return res.status(400).json({ error: 'Already registered for this hackathon' });
    }

    // Create registration
    const registration = await prisma.registration.create({
      data: {
        userId,
        hackathonId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            skills: true
          }
        },
        hackathon: {
          select: {
            title: true,
            registrationDeadline: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Successfully registered for hackathon',
      registration
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

// routes/team.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get teams for a hackathon
router.get('/:hackathonId', async (req, res) => {
  try {
    const { hackathonId } = req.params;

    const teams = await prisma.team.findMany({
      where: { hackathonId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                skills: true
              }
            }
          }
        }
      }
    });

    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's team for a hackathon
router.get('/:hackathonId/my-team', authenticateToken, async (req, res) => {
  try {
    const { hackathonId } = req.params;
    const userId = req.user.userId;

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId,
        team: {
          hackathonId
        }
      },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    skills: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'No team assigned yet' });
    }

    res.json(teamMember.team);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

// utils/scheduler.js
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendTeamNotification } from './emailService.js';

const prisma = new PrismaClient();

export const startScheduler = (io) => {
  // Check every minute for hackathons with passed registration deadlines
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      // Find hackathons where registration just closed (within last minute)
      const hackathons = await prisma.hackathon.findMany({
        where: {
          registrationDeadline: {
            lte: now,
            gte: new Date(now.getTime() - 60000) // Last minute
          },
          isActive: true,
          teams: {
            none: {} // No teams created yet
          }
        },
        include: {
          registrations: {
            include: {
              user: true
            }
          }
        }
      });

      for (const hackathon of hackathons) {
        await createTeamsForHackathon(hackathon, io);
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  });
};

const createTeamsForHackathon = async (hackathon, io) => {
  try {
    const { registrations, maxTeamSize, problemStatements } = hackathon;
    
    if (registrations.length === 0) {
      console.log(`No registrations for hackathon: ${hackathon.title}`);
      return;
    }

    // Shuffle registrations randomly
    const shuffledUsers = registrations
      .map(reg => reg.user)
      .sort(() => Math.random() - 0.5);

    const teams = [];
    const createdTeams = [];

    // Create teams of specified size
    for (let i = 0; i < shuffledUsers.length; i += maxTeamSize) {
      const teamMembers = shuffledUsers.slice(i, i + maxTeamSize);
      
      // Random problem statement
      const randomProblem = problemStatements[
        Math.floor(Math.random() * problemStatements.length)
      ];

      // Create team in database
      const team = await prisma.team.create({
        data: {
          hackathonId: hackathon.id,
          problemStatement: randomProblem,
          members: {
            create: teamMembers.map(user => ({
              userId: user.id
            }))
          }
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  skills: true
                }
              }
            }
          }
        }
      });

      createdTeams.push(team);

      // Send email to team members
      for (const member of team.members) {
        const teammates = team.members
          .filter(m => m.user.id !== member.user.id)
          .map(m => m.user.name);

        await sendTeamNotification({
          email: member.user.email,
          name: member.user.name,
          hackathonTitle: hackathon.title,
          teammates,
          problemStatement: randomProblem
        });
      }
    }

    // Notify all connected clients via WebSocket
    io.to(hackathon.id).emit('teams-formed', {
      hackathonId: hackathon.id,
      teams: createdTeams
    });

    console.log(`Created ${createdTeams.length} teams for ${hackathon.title}`);
  } catch (error) {
    console.error('Error creating teams:', error);
  }
};

// utils/emailService.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendTeamNotification = async ({
  email,
  name,
  hackathonTitle,
  teammates,
  problemStatement
}) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `🎉 Your Team is Ready - ${hackathonTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">🎉 Team Formation Complete!</h2>
          
          <p>Hi <strong>${name}</strong>,</p>
          
          <p>Great news! Your team has been automatically formed for <strong>${hackathonTitle}</strong>.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">👥 Your Teammates:</h3>
            <ul>
              ${teammates.map(teammate => `<li>${teammate}</li>`).join('')}
            </ul>
          </div>
          
          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1976d2; margin-top: 0;">🎯 Problem Statement:</h3>
            <p style="font-size: 16px; line-height: 1.5;">${problemStatement}</p>
          </div>
          
          <p>Start collaborating with your teammates and build something amazing! 🚀</p>
          
          <p>Best of luck!<br>The Hackathon Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Team notification sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// utils/seedData.js (Optional - for testing)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedHackathon = async () => {
  try {
    const hackathon = await prisma.hackathon.create({
      data: {
        title: "Innovation Challenge 2024",
        description: "Build the next big thing in tech!",
        registrationDeadline: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from now
        startDate: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        problemStatements: [
          "Build a sustainable tech solution for climate change",
          "Create an AI-powered healthcare application",
          "Develop a blockchain-based supply chain tracker",
          "Design a smart city management system",
          "Build a social platform for remote learning"
        ]
      }
    });

    console.log('Hackathon seeded:', hackathon);
  } catch (error) {
    console.error('Seeding error:', error);
  }
};