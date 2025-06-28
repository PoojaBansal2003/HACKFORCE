const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsapp.controller");

// Send message
router.post("/send", whatsappController.sendMessage);

// Receive message webhook (for replies)
router.post("/webhook", whatsappController.receiveMessage);

module.exports = router;
