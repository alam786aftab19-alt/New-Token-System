const supabase = require('../config/db');

/**
 * Generates the next sequential token number for a specific doctor on a specific date.
 * Relies on the daily count/max token of appointments for that doctor.
 * 
 * @param {number} doctorId - ID of the doctor
 * @param {string} dateString - Format YYYY-MM-DD
 * @returns {Promise<number>} Next token number (starts at 1)
 */
async function generateNextToken(doctorId, dateString) {
  try {
    const { data, error } = await supabase
      .from('NewTokenSystem_appointments')
      .select('token_number')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', dateString)
      .order('token_number', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[TokenService] Error fetching max token:', error);
      throw error;
    }

    if (data && data.length > 0) {
      return data[0].token_number + 1;
    }

    // Default to 1 if no tokens generated for this doctor today
    return 1;
  } catch (err) {
    console.error('[TokenService] Exception in generateNextToken:', err);
    throw err;
  }
}

module.exports = {
  generateNextToken
};
