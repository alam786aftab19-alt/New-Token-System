const express = require('express');
const router = express.Router();
const {
  getUsers,
  deleteUser,
  getStats,
  createDepartment,
  deleteDepartment
} = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All routes here require verification and restricting to Admins
router.use(protect);
router.use(restrictTo('admin'));

router.get('/users', getUsers);
router.delete('/users/:id', deleteUser);
router.get('/stats', getStats);
router.post('/departments', createDepartment);
router.delete('/departments/:id', deleteDepartment);

module.exports = router;
