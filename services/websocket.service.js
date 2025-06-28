const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const config = require("../config/config");
const User = require("../models/user.model");
// Add this model for sensor data storage
const SensorData = require("../models/server.model");
const { AudioClipManager } = require("./AudioClipManager");

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Connected web clients
    this.esp32Client = null; // Single ESP32 device
    this.esp32Status = {
      connected: false,
      lastSeen: null,
      deviceInfo: null,
      sensorTypes: [],
      isStreaming: false,
    };
    // this.audioClipManager = new AudioClipManager(10000, "./audio_clips");
    // Heartbeat configuration
    this.heartbeatInterval = 30000; // 30 seconds
    this.esp32TimeoutInterval = 60000; // 1 minute timeout for ESP32
    this.pingInterval = null;
    this.statusCheckInterval = null;
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      this.handleUpgrade(request, socket, head).catch((err) => {
        logger.error(`Upgrade failed: ${err.message}`);
        socket.destroy();
      });
    });

    this.setupEventHandlers();
    this.startStatusMonitoring();
    logger.info("WebSocket server initialized");
  }

  async handleUpgrade(request, socket, head) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      // Handle ESP32 connection (no authentication required)
      if (url.pathname === "/esp32") {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
        return;
      }

      // Handle web client authentication
      const { user, error } = await this.verifyClient(request);
      if (error || !user) {
        logger.warn(`Rejected connection: ${error}`);
        return socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit("connection", ws, request);
      });
    } catch (err) {
      logger.error(`Upgrade error: ${err.message}`);
      throw err;
    }
  }

  async verifyClient(request) {
    try {
      const origin = request.headers.origin;
      if (!this.isOriginAllowed(origin)) {
        return { error: "Origin not allowed" };
      }

      const token = this.extractToken(request);
      if (!token) {
        return { error: "No token provided" };
      }

      const decoded = await new Promise((resolve, reject) => {
        jwt.verify(token, config.jwt.secret, (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        });
      });

      if (!decoded?.id) {
        return { error: "Invalid token payload" };
      }

      const user = await User.findById(decoded.id);
      request.user = user;
      return { user: user };
    } catch (err) {
      logger.warn(`Verification failed: ${err.message}`);
      return { error: err.message };
    }
  }

  extractToken(request) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      return (
        url.searchParams.get("token") ||
        request.headers["sec-websocket-protocol"] ||
        request.headers["authorization"]?.split(" ")[1]
      );
    } catch (err) {
      return null;
    }
  }

  isOriginAllowed(origin) {
    if (!origin || process.env.NODE_ENV === "development") return true;

    const allowedOrigins = [
      ...(config.cors?.allowedOrigins || []),
      `http://${config.server.host}:${config.server.port}`,
      "http://localhost:3000",
    ];

    return allowedOrigins.includes(origin) || allowedOrigins.includes("*");
  }

  setupEventHandlers() {
    this.wss.on("connection", (ws, request) => {
      const url = new URL(request.url, `http://${request.headers.host}`);

      // Handle ESP32 connection
      if (url.pathname === "/esp32") {
        this.handleESP32Connection(ws);
        return;
      }

      // Handle web client connection
      const userId = request.user?.id;
      if (!userId) {
        return ws.close(1008, "Authentication failed");
      }

      this.handleClientConnection(ws, userId);
    });

    this.startHeartbeat();
  }

  handleESP32Connection(ws) {
    // Only allow one ESP32 connection
    if (this.esp32Client && this.esp32Client.readyState === WebSocket.OPEN) {
      logger.warn("ESP32 already connected, closing previous connection");
      this.esp32Client.close();
    }

    this.esp32Client = ws;
    this.esp32Status.connected = true;
    this.esp32Status.lastSeen = new Date();

    logger.info("ESP32 connected");

    // Send connection confirmation to ESP32
    this.sendToESP32({
      type: "connection-established",
      serverTime: new Date().toISOString(),
    });

    // Notify all web clients about ESP32 connection
    this.broadcastToClients({
      type: "esp32-status",
      status: "connected",
      timestamp: new Date().toISOString(),
    });

    // Setup ESP32 message handlers
    ws.on("message", (data) => {
      this.handleESP32Message(data);
    });

    ws.on("close", () => {
      logger.info("ESP32 disconnected");
      this.handleESP32Disconnect();
    });

    ws.on("error", (err) => {
      logger.error(`ESP32 error: ${err.message}`);
      this.handleESP32Disconnect();
    });

    // ESP32 heartbeat
    ws.on("pong", () => {
      this.esp32Status.lastSeen = new Date();
    });
  }

  handleClientConnection(ws, userId) {
    logger.info(`Client connected: ${userId}`);

    // Send connection confirmation and current ESP32 status
    ws.send(
      JSON.stringify({
        type: "connection",
        status: "authenticated",
        userId,
        esp32Status: this.esp32Status,
        timestamp: new Date().toISOString(),
      })
    );

    this.addClient(userId, ws);

    // Setup client heartbeat
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Message handler
    ws.on("message", (data) => {
      this.handleClientMessage(ws, userId, data);
    });

    ws.on("close", () => {
      logger.info(`Client disconnected: ${userId}`);
      this.removeClient(userId);
    });

    ws.on("error", (err) => {
      logger.error(`Client error ${userId}: ${err.message}`);
      this.removeClient(userId);
    });
  }

  handleESP32Message(data) {
    try {
      this.esp32Status.lastSeen = new Date();
      // logger.info(data);
      // Handle binary data (if ESP32 sends raw sensor data)
      if (data instanceof Buffer) {
        // this.audioClipManager.addAudioData(data, new Date());
        logger.debug("Received binary data from ESP32");
        // Broadcast binary data to clients if needed
        // logger.info(data);
        const base64Audio = data.toString("base64");
        this.broadcastToClients({
          type: "audio-data",
          timestamp: new Date().toISOString(),
          dataSize: data.length,
          data: base64Audio,
        });
        console.log(base64Audio);
        return;
        // return;
      }
      // Handle JSON messages
      logger.info(
        "HURRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR"
      );
      const message = JSON.parse(data.toString());
      logger.info(`ESP32 message: ${message.type}`);

      switch (message.type) {
        case "device-info":
          this.handleDeviceInfo(message);
          break;
        case "sensor-data":
          this.handleSensorData(message);
          break;
        case "status-update":
          this.handleStatusUpdate(message);
          break;
        case "ping":
          this.sendToESP32({ type: "pong", timestamp: Date.now() });
          break;
        default:
          logger.debug(`Unhandled ESP32 message type: ${message.type}`);
      }
    } catch (err) {
      logger.error(`ESP32 message handling error: ${err.message}`);
    }
  }

  handleClientMessage(ws, userId, data) {
    try {
      const message = JSON.parse(data);
      logger.debug(`Client ${userId} message: ${message.type}`);

      switch (message.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          break;
        case "get-esp32-status":
          this.sendToUser(userId, {
            type: "esp32-status-response",
            status: this.esp32Status,
          });
          break;
        case "get-sensor-data":
          this.handleGetSensorData(userId, message);
          break;
        case "control-esp32":
          this.handleControlESP32(userId, message);
          break;
        default:
          logger.debug(`Unhandled client message type: ${message.type}`);
      }
    } catch (err) {
      logger.error(`Client message handling error: ${err.message}`);
    }
  }

  handleDeviceInfo(message) {
    try {
      this.esp32Status.deviceInfo = {
        deviceName: message.deviceName || "ESP32-Sensor",
        firmwareVersion: message.firmwareVersion || "unknown",
        capabilities: message.capabilities || [],
        sensorTypes: message.sensorTypes || [],
        batteryLevel: message.batteryLevel,
        signalStrength: message.signalStrength,
      };

      this.esp32Status.sensorTypes = message.sensorTypes || [];

      logger.info("ESP32 device info updated:", this.esp32Status.deviceInfo);

      // Broadcast device info to all clients
      this.broadcastToClients({
        type: "esp32-device-info",
        deviceInfo: this.esp32Status.deviceInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error handling device info: ${error.message}`);
    }
  }

  async handleSensorData(message) {
    try {
      const sensorData = {
        timestamp: new Date(),
        sensorType: message.sensorType || "unknown",
        data: message.data || {},
        deviceId: "esp32-main", // Fixed device ID for single ESP32
        ...message,
      };

      // Save to database
      await this.saveSensorDataToDatabase(sensorData);

      // Broadcast to all connected clients immediately
      this.broadcastToClients({
        type: "sensor-data",
        ...sensorData,
      });

      logger.debug(
        `Sensor data processed and broadcasted: ${sensorData.sensorType}`
      );
    } catch (error) {
      logger.error(`Error handling sensor data: ${error.message}`);
    }
  }

  handleStatusUpdate(message) {
    try {
      this.esp32Status.isStreaming = message.isStreaming || false;
      this.esp32Status.deviceInfo = {
        ...this.esp32Status.deviceInfo,
        batteryLevel: message.batteryLevel,
        signalStrength: message.signalStrength,
        status: message.status || "online",
      };
      logger.info(`ESP-32 Status Updated ${message}`);

      // Broadcast status update to all clients
      this.broadcastToClients({
        type: "esp32-status-update",
        status: this.esp32Status,
        timestamp: new Date().toISOString(),
      });

      logger.debug("ESP32 status updated");
    } catch (error) {
      logger.error(`Error handling status update: ${error.message}`);
    }
  }

  handleESP32Disconnect() {
    this.esp32Client = null;
    this.esp32Status.connected = false;
    this.esp32Status.isStreaming = false;

    // Notify all clients about ESP32 disconnection
    this.broadcastToClients({
      type: "esp32-status",
      status: "disconnected",
      timestamp: new Date().toISOString(),
    });

    logger.info("ESP32 disconnected and status updated");
  }

  async handleGetSensorData(userId, message) {
    try {
      const { sensorType, limit = 100, startDate, endDate } = message;

      // Build query
      const query = { deviceId: "esp32-main" };

      if (sensorType && sensorType !== "all") {
        query.sensorType = sensorType;
      }

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      // Fetch from database
      const sensorData = await SensorData.find(query)
        .sort({ timestamp: -1 })
        .limit(limit);

      this.sendToUser(userId, {
        type: "sensor-data-history",
        data: sensorData,
        query: { sensorType, limit, startDate, endDate },
      });
    } catch (error) {
      logger.error(`Error getting sensor data: ${error.message}`);
      this.sendToUser(userId, {
        type: "error",
        message: "Failed to retrieve sensor data",
      });
    }
  }

  handleControlESP32(userId, message) {
    try {
      const { command, parameters } = message;

      if (!this.esp32Client || this.esp32Client.readyState !== WebSocket.OPEN) {
        return this.sendToUser(userId, {
          type: "error",
          message: "ESP32 not connected",
        });
      }

      // Send command to ESP32
      this.sendToESP32({
        type: "command",
        command: command,
        parameters: parameters || {},
        requestId: `cmd_${Date.now()}`,
        fromUserId: userId,
      });

      // Send confirmation to user
      this.sendToUser(userId, {
        type: "command-sent",
        command: command,
        timestamp: new Date().toISOString(),
      });

      logger.info(`User ${userId} sent command '${command}' to ESP32`);
    } catch (error) {
      logger.error(`Error controlling ESP32: ${error.message}`);
    }
  }

  async saveSensorDataToDatabase(sensorData) {
    try {
      const newSensorData = new SensorData({
        deviceId: sensorData.deviceId,
        sensorType: sensorData.sensorType,
        data: sensorData.data,
        timestamp: sensorData.timestamp,
        metadata: {
          batteryLevel: this.esp32Status.deviceInfo?.batteryLevel,
          signalStrength: this.esp32Status.deviceInfo?.signalStrength,
        },
      });

      await newSensorData.save();
      logger.debug(`Sensor data saved to database: ${sensorData.sensorType}`);
    } catch (error) {
      logger.error(`Failed to save sensor data to database: ${error.message}`);
    }
  }

  // Status monitoring
  startStatusMonitoring() {
    this.statusCheckInterval = setInterval(() => {
      this.checkESP32Status();
    }, 30000); // Check every 30 seconds
  }

  checkESP32Status() {
    if (this.esp32Status.connected && this.esp32Status.lastSeen) {
      const timeSinceLastSeen =
        Date.now() - this.esp32Status.lastSeen.getTime();

      if (timeSinceLastSeen > this.esp32TimeoutInterval) {
        logger.warn("ESP32 appears to be offline (timeout)");
        this.esp32Status.connected = false;

        // Notify clients about offline status
        this.broadcastToClients({
          type: "esp32-status",
          status: "offline",
          lastSeen: this.esp32Status.lastSeen,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  startHeartbeat() {
    this.pingInterval = setInterval(() => {
      // Ping web clients
      this.clients.forEach((ws, userId) => {
        if (ws.isAlive === false) {
          logger.warn(`Terminating unresponsive client: ${userId}`);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });

      // Ping ESP32
      if (this.esp32Client && this.esp32Client.readyState === WebSocket.OPEN) {
        this.esp32Client.ping();
      }
    }, this.heartbeatInterval);
  }

  // Utility methods
  sendToESP32(message) {
    if (this.esp32Client && this.esp32Client.readyState === WebSocket.OPEN) {
      try {
        this.esp32Client.send(JSON.stringify(message));
        return true;
      } catch (error) {
        logger.error(`Error sending to ESP32: ${error.message}`);
        return false;
      }
    }
    return false;
  }

  sendToUser(userId, data) {
    const client = this.clients.get(userId);
    if (!client || client.readyState !== WebSocket.OPEN) return false;

    try {
      client.send(JSON.stringify(data));
      return true;
    } catch (err) {
      logger.error(`Send error to ${userId}: ${err.message}`);
      this.removeClient(userId);
      return false;
    }
  }

  broadcastToClients(data) {
    let successCount = 0;
    this.clients.forEach((client, userId) => {
      if (this.sendToUser(userId, data)) {
        successCount++;
      }
    });

    if (successCount > 0) {
      logger.debug(`Broadcasted to ${successCount} clients`);
    }

    return successCount;
  }

  addClient(userId, ws) {
    // Close existing connection if present
    if (this.clients.has(userId)) {
      this.clients.get(userId).close(1001, "Duplicate connection");
    }

    this.clients.set(userId, ws);
    logger.info(`Client ${userId} connected (${this.clients.size} total)`);
  }

  removeClient(userId) {
    if (this.clients.delete(userId)) {
      logger.info(
        `Client ${userId} disconnected (${this.clients.size} remaining)`
      );
    }
  }

  // Stats and monitoring
  getSystemStats() {
    return {
      connectedClients: this.clients.size,
      esp32Status: this.esp32Status,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  // Cleanup
  shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    if (this.esp32Client) {
      this.esp32Client.close();
    }

    this.clients.forEach((client) => {
      client.close();
    });

    logger.info("WebSocket service shut down");
  }
}

module.exports = new WebSocketService();
