const supabase = require('../config/db');
const { generateNextToken } = require('../services/tokenService');
const { sendAppointmentEmail } = require('../services/emailService');

/**
 * Book a new appointment / generate a token.
 */
async function bookAppointment(req, res) {
  const { doctor_id, department_id, appointment_date, notes } = req.body;

  if (!doctor_id || !department_id || !appointment_date) {
    return res.status(400).json({ success: false, message: 'Doctor, department, and date are required' });
  }

  // Ensure user is booking for themselves (only patient can book, or admin on behalf of users)
  const userId = req.user.role === 'admin' && req.body.user_id ? req.body.user_id : req.user.id;

  try {
    // Generate sequential token number for this doctor on this day
    const tokenNumber = await generateNextToken(parseInt(doctor_id), appointment_date);

    const { data: appointment, error } = await supabase
      .from('NewTokenSystem_appointments')
      .insert({
        user_id: userId,
        doctor_id: parseInt(doctor_id),
        department_id: parseInt(department_id),
        appointment_date,
        token_number: tokenNumber,
        status: 'pending',
        notes: notes || ''
      })
      .select('*, doctors:NewTokenSystem_doctors(name), departments:NewTokenSystem_departments(name), users:NewTokenSystem_users(name, email)')
      .single();

    if (error) {
      throw error;
    }

    // Trigger email notification
    await sendAppointmentEmail(
      appointment.users.email,
      appointment.users.name,
      appointment.doctors.name,
      appointment.appointment_date,
      appointment.token_number,
      'pending'
    );

    return res.status(201).json({
      success: true,
      message: `Appointment booked successfully! Your Token Number is #${tokenNumber}`,
      data: appointment
    });
  } catch (error) {
    console.error('[BookAppointment] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Retrieve appointments based on user role and query parameters.
 */
async function getAppointments(req, res) {
  const { role, id } = req.user;
  const { status, date } = req.query;

  try {
    let query = supabase
      .from('NewTokenSystem_appointments')
      .select('*, users:NewTokenSystem_users(id, name, email, phone), doctors:NewTokenSystem_doctors(id, name, specialization, departments:NewTokenSystem_departments(name)), departments:NewTokenSystem_departments(id, name)')
      .order('appointment_date', { ascending: true })
      .order('token_number', { ascending: true });

    // Role-based scoping
    if (role === 'patient') {
      query = query.eq('user_id', id);
    } else if (role === 'doctor') {
      query = query.eq('doctor_id', id);
    } // Admins see all

    // Additional filters
    if (status) {
      query = query.eq('status', status);
    }
    if (date) {
      query = query.eq('appointment_date', date);
    }

    const { data: appointments, error } = await query;

    if (error) {
      throw error;
    }

    // Enrich appointments with live queue calculations for patients
    if (role === 'patient') {
      const enriched = await Promise.all(appointments.map(async (apt) => {
        // Find the token number of the active (confirmed) appointment for this doctor today
        const { data: activeApts } = await supabase
          .from('NewTokenSystem_appointments')
          .select('token_number')
          .eq('doctor_id', apt.doctor_id)
          .eq('appointment_date', apt.appointment_date)
          .eq('status', 'confirmed')
          .limit(1);

        const currentlyServing = activeApts && activeApts.length > 0 ? activeApts[0].token_number : null;

        // Count pending appointments booked before this patient's token
        const { count: aheadCount } = await supabase
          .from('NewTokenSystem_appointments')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', apt.doctor_id)
          .eq('appointment_date', apt.appointment_date)
          .eq('status', 'pending')
          .lt('token_number', apt.token_number);

        return {
          ...apt,
          currently_serving: currentlyServing,
          patients_ahead: aheadCount || 0
        };
      }));

      return res.json({ success: true, data: enriched });
    }

    return res.json({ success: true, data: appointments });
  } catch (error) {
    console.error('[GetAppointments] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Update appointment details/status.
 */
async function updateAppointment(req, res) {
  const { id } = req.params;
  const { status, notes } = req.body;
  const { role, id: userId } = req.user;

  try {
    // 1. Fetch current appointment
    const { data: current, error: getError } = await supabase
      .from('NewTokenSystem_appointments')
      .select('*, users:NewTokenSystem_users(name, email), doctors:NewTokenSystem_doctors(name)')
      .eq('id', id)
      .single();

    if (getError || !current) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // 2. Validate authorization
    if (role === 'patient') {
      // Patients can only cancel their own pending appointments
      if (current.user_id !== userId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to edit this appointment' });
      }
      if (status && status !== 'cancelled') {
        return res.status(400).json({ success: false, message: 'Patients can only cancel appointments' });
      }
    } else if (role === 'doctor') {
      // Doctors can only manage their own appointments
      if (current.doctor_id !== userId) {
        return res.status(403).json({ success: false, message: 'Unauthorized: Doctor not assigned to this appointment' });
      }
    }

    // 3. Perform update
    const updateFields = {};
    if (status) updateFields.status = status;
    if (notes) updateFields.notes = notes;

    const { data: updated, error: updateError } = await supabase
      .from('NewTokenSystem_appointments')
      .update(updateFields)
      .eq('id', id)
      .select('*, users:NewTokenSystem_users(name, email), doctors:NewTokenSystem_doctors(name), departments:NewTokenSystem_departments(name)')
      .single();

    if (updateError) {
      throw updateError;
    }

    // 4. Send status change email
    if (status) {
      await sendAppointmentEmail(
        updated.users.email,
        updated.users.name,
        updated.doctors.name,
        updated.appointment_date,
        updated.token_number,
        status
      );
    }

    return res.json({ success: true, message: 'Appointment updated successfully', data: updated });
  } catch (error) {
    console.error('[UpdateAppointment] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Delete an appointment (Admin only).
 */
async function deleteAppointment(req, res) {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('NewTokenSystem_appointments')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return res.json({ success: true, message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('[DeleteAppointment] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  bookAppointment,
  getAppointments,
  updateAppointment,
  deleteAppointment
};
