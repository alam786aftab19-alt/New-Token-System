const bcrypt = require('bcryptjs');
const supabase = require('../config/db');

/**
 * Get all doctors, with department detail joins.
 */
async function getAllDoctors(req, res) {
  const { departmentId } = req.query;

  try {
    let query = supabase
      .from('NewTokenSystem_doctors')
      .select('*, departments:NewTokenSystem_departments(id, name)');

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    const { data: doctors, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({ success: true, data: doctors });
  } catch (error) {
    console.error('[GetAllDoctors] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Create a new doctor (Admin only).
 */
async function createDoctor(req, res) {
  const { name, email, password, phone, department_id, specialization, experience, bio } = req.body;

  if (!name || !email || !password || !specialization) {
    return res.status(400).json({ success: false, message: 'Name, email, password, and specialization are required' });
  }

  try {
    // Check email uniqueness
    const { data: existingUser } = await supabase.from('NewTokenSystem_users').select('id').eq('email', email.toLowerCase()).single();
    const { data: existingDoc } = await supabase.from('NewTokenSystem_doctors').select('id').eq('email', email.toLowerCase()).single();

    if (existingUser || existingDoc) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: doctor, error } = await supabase
      .from('NewTokenSystem_doctors')
      .insert({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone,
        department_id: department_id ? parseInt(department_id) : null,
        specialization,
        experience: experience ? parseInt(experience) : 0,
        bio
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ success: true, message: 'Doctor added successfully', data: doctor });
  } catch (error) {
    console.error('[CreateDoctor] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Update a doctor's profile.
 */
async function updateDoctor(req, res) {
  const { id } = req.params;
  const { name, email, password, phone, department_id, specialization, experience, bio } = req.body;

  // Security: Check if user is Admin OR the Doctor editing their own profile
  if (req.user.role !== 'admin' && (req.user.role !== 'doctor' || req.user.id !== parseInt(id))) {
    return res.status(403).json({ success: false, message: 'Access denied: Unauthorized to edit this doctor' });
  }

  try {
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (phone) updateData.phone = phone;
    if (department_id) updateData.department_id = parseInt(department_id);
    if (specialization) updateData.specialization = specialization;
    if (experience) updateData.experience = parseInt(experience);
    if (bio) updateData.bio = bio;

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const { data: updatedDoctor, error } = await supabase
      .from('NewTokenSystem_doctors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({ success: true, message: 'Doctor updated successfully', data: updatedDoctor });
  } catch (error) {
    console.error('[UpdateDoctor] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Delete a doctor (Admin only).
 */
async function deleteDoctor(req, res) {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('NewTokenSystem_doctors')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return res.json({ success: true, message: 'Doctor profile deleted successfully' });
  } catch (error) {
    console.error('[DeleteDoctor] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Fetch all departments.
 */
async function getDepartments(req, res) {
  try {
    const { data: departments, error } = await supabase
      .from('NewTokenSystem_departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return res.json({ success: true, data: departments });
  } catch (error) {
    console.error('[GetDepartments] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  getAllDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDepartments
};
