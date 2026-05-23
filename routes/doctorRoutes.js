const express = require('express');
const router = express.Router();
const {
  getAllDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDepartments
} = require('../controllers/doctorController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Public routes (anyone can see doctors and departments)
router.get('/departments', getDepartments);
router.get('/', getAllDoctors);

// Protected routes (admin/doctor actions)
router.post('/', protect, restrictTo('admin'), createDoctor);
router.put('/:id', protect, updateDoctor); // Authentication verified inside controller for self-updates
router.delete('/:id', protect, restrictTo('admin'), deleteDoctor);

module.exports = router;
