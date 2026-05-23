const express = require('express');
const router = express.Router();
const {
  bookAppointment,
  getAppointments,
  updateAppointment,
  deleteAppointment
} = require('../controllers/appointmentController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect); // All appointment actions require user to be logged in

router.post('/', bookAppointment);
router.get('/', getAppointments);
router.put('/:id', updateAppointment);
router.delete('/:id', restrictTo('admin'), deleteAppointment);

module.exports = router;
