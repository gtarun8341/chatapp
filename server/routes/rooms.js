// routes/rooms.js
const express = require('express');
const router = express.Router();

const { createRoom, getRooms, joinRoom } = require('../controllers/rooms');

router.post('/create', createRoom);
router.get('/list', getRooms);
router.post('/join', joinRoom);

module.exports = router;
