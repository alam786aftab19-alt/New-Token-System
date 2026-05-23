const supabase = require('../config/db');

/**
 * Get all registered patients/users (Admin only).
 */
async function getUsers(req, res) {
  try {
    const { data: users, error } = await supabase
      .from('NewTokenSystem_users')
      .select('id, name, email, phone, role, is_verified, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({ success: true, data: users });
  } catch (error) {
    console.error('[AdminGetUsers] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Delete / Block a user (Admin only).
 */
async function deleteUser(req, res) {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('NewTokenSystem_users')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('[AdminDeleteUser] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Get system analytics stats (Admin only).
 */
async function getStats(req, res) {
  try {
    // 1. Fetch total counts
    const { count: patientCount, error: err1 } = await supabase
      .from('NewTokenSystem_users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'patient');

    const { count: doctorCount, error: err2 } = await supabase
      .from('NewTokenSystem_doctors')
      .select('*', { count: 'exact', head: true });

    const { count: deptCount, error: err3 } = await supabase
      .from('NewTokenSystem_departments')
      .select('*', { count: 'exact', head: true });

    const { count: totalAppointments, error: err4 } = await supabase
      .from('NewTokenSystem_appointments')
      .select('*', { count: 'exact', head: true });

    if (err1 || err2 || err3 || err4) {
      throw new Error('Error counting tables');
    }

    // 2. Fetch today's count
    const today = new Date().toISOString().split('T')[0];
    const { count: todayAppointments } = await supabase
      .from('NewTokenSystem_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('appointment_date', today);

    // 3. Fetch count by status
    const { data: statusStats, error: statusErr } = await supabase
      .from('NewTokenSystem_appointments')
      .select('status');

    if (statusErr) throw statusErr;

    const stats = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0
    };

    statusStats.forEach(item => {
      const s = item.status ? item.status.toLowerCase() : 'pending';
      if (stats[s] !== undefined) {
        stats[s]++;
      }
    });

    return res.json({
      success: true,
      data: {
        patients: patientCount || 0,
        doctors: doctorCount || 0,
        departments: deptCount || 0,
        appointments: {
          total: totalAppointments || 0,
          today: todayAppointments || 0,
          pending: stats.pending,
          confirmed: stats.confirmed,
          completed: stats.completed,
          cancelled: stats.cancelled
        }
      }
    });
  } catch (error) {
    console.error('[AdminGetStats] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Create a new department (Admin only).
 */
async function createDepartment(req, res) {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Department name is required' });
  }

  try {
    const { data: newDept, error } = await supabase
      .from('NewTokenSystem_departments')
      .insert({ name, description })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ success: true, message: 'Department created successfully', data: newDept });
  } catch (error) {
    console.error('[AdminCreateDept] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Delete a department (Admin only).
 */
async function deleteDepartment(req, res) {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('NewTokenSystem_departments')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    console.error('[AdminDeleteDept] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  getUsers,
  deleteUser,
  getStats,
  createDepartment,
  deleteDepartment
};
