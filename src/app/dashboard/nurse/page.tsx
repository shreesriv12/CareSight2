'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import {
  User,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  Pill,
  Building2,
  Calendar,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
} from 'lucide-react';

type Nurse = {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  phone_number: string;
  shift: string;
  hospital_id: string;
  patient_ids: string[];
};

type Hospital = {
  id: string;
  name: string;
  address: string;
  email: string;
  phone_number: string;
};

type Patient = {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  age: number;
  gender: string;
  room: string;
  diagnosis: string;
};

type Medication = {
  id: string;
  patient_id: string;
  name: string;
  dosage: any; // jsonb type
  createdat?: string;
  updatedat?: string;
};

type MedicationForm = {
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  instructions: string;
};

const NurseDashboard: React.FC = () => {
  const [nurseData, setNurseData] = useState<Nurse | null>(null);
  const [hospitalData, setHospitalData] = useState<Hospital | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medications, setMedications] = useState<Record<string, Medication[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Medication management states
  const [showMedicationForm, setShowMedicationForm] = useState<string | null>(null);
  const [editingMedication, setEditingMedication] = useState<string | null>(null);
  const [medicationForm, setMedicationForm] = useState<MedicationForm>({
    name: '',
    dosage: '',
    frequency: '',
    timing: '',
    instructions: '',
  });
  const [medicationLoading, setMedicationLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = localStorage.getItem('user_id');
        const role = localStorage.getItem('role');

        if (role !== 'nurse') {
          setError('Access denied. Nurse role required.');
          setLoading(false);
          return;
        }

        if (!userId) {
          setError('No user ID found in localStorage.');
          setLoading(false);
          return;
        }

        // 1. Fetch nurse data
        const { data: nurse, error: nurseError } = await createClient()
          .from('nurse')
          .select('*')
          .eq('id', userId)
          .single();

        if (nurseError || !nurse) throw new Error('Nurse data not found.');
        setNurseData(nurse);

        // 2. Fetch hospital
        const { data: hospital, error: hospitalError } = await supabase
          .from('hospital')
          .select('*')
          .eq('id', nurse.hospital_id)
          .single();

        if (hospitalError || !hospital) throw new Error('Hospital not found.');
        setHospitalData(hospital);

        // 3. Fetch patients
        const { data: patientList, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .in('id', nurse.patient_ids || []);

        if (patientError) throw patientError;
        setPatients(patientList || []);

        // 4. Fetch medications
        await fetchMedications(nurse.patient_ids || []);
      } catch (err: any) {
        console.error('Error loading dashboard:', err);
        setError(err.message || 'Unexpected error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchMedications = async (patientIds: string[]) => {
    try {
      const { data: meds, error: medError } = await supabase
        .from('medication')
        .select('*')
        .in('patient_id', patientIds);

      if (medError) throw medError;

      const medMap: Record<string, Medication[]> = {};
      for (const med of meds || []) {
        if (!medMap[med.patient_id]) medMap[med.patient_id] = [];
        medMap[med.patient_id].push(med);
      }

      setMedications(medMap);
    } catch (err) {
      console.error('Error fetching medications:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('user_id');
      localStorage.removeItem('role');
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const resetMedicationForm = () => {
    setMedicationForm({
      name: '',
      dosage: '',
      frequency: '',
      timing: '',
      instructions: '',
    });
    setShowMedicationForm(null);
    setEditingMedication(null);
  };

  const handleAddMedication = async (patientId: string) => {
    if (!medicationForm.name || !medicationForm.dosage) {
      alert('Please fill in medication name and dosage');
      return;
    }

    setMedicationLoading(true);
    try {
      const dosageData = {
        amount: medicationForm.dosage,
        frequency: medicationForm.frequency,
        timing: medicationForm.timing,
        instructions: medicationForm.instructions,
      };

      const { data, error } = await supabase
        .from('medication')
        .insert([
          {
            patient_id: patientId,
            name: medicationForm.name,
            dosage: dosageData,
          },
        ])
        .select();

      if (error) throw error;

      // Refresh medications
      await fetchMedications(nurseData?.patient_ids || []);
      resetMedicationForm();
      alert('Medication added successfully');
    } catch (err: any) {
      console.error('Error adding medication:', err);
      alert('Failed to add medication: ' + err.message);
    } finally {
      setMedicationLoading(false);
    }
  };

  const handleEditMedication = (medication: Medication) => {
    const dosageData = medication.dosage || {};
    setMedicationForm({
      name: medication.name,
      dosage: dosageData.amount || '',
      frequency: dosageData.frequency || '',
      timing: dosageData.timing || '',
      instructions: dosageData.instructions || '',
    });
    setEditingMedication(medication.id);
    setShowMedicationForm(medication.patient_id);
  };

  const handleUpdateMedication = async (patientId: string) => {
    if (!medicationForm.name || !medicationForm.dosage) {
      alert('Please fill in medication name and dosage');
      return;
    }

    setMedicationLoading(true);
    try {
      const dosageData = {
        amount: medicationForm.dosage,
        frequency: medicationForm.frequency,
        timing: medicationForm.timing,
        instructions: medicationForm.instructions,
      };

      const { error } = await supabase
        .from('medication')
        .update({
          name: medicationForm.name,
          dosage: dosageData,
          updatedat: new Date().toISOString(),
        })
        .eq('id', editingMedication);

      if (error) throw error;

      // Refresh medications
      await fetchMedications(nurseData?.patient_ids || []);
      resetMedicationForm();
      alert('Medication updated successfully');
    } catch (err: any) {
      console.error('Error updating medication:', err);
      alert('Failed to update medication: ' + err.message);
    } finally {
      setMedicationLoading(false);
    }
  };

  const handleDeleteMedication = async (medicationId: string) => {
    if (!confirm('Are you sure you want to delete this medication?')) return;

    setMedicationLoading(true);
    try {
      const { error } = await supabase
        .from('medication')
        .delete()
        .eq('id', medicationId);

      if (error) throw error;

      // Refresh medications
      await fetchMedications(nurseData?.patient_ids || []);
      alert('Medication deleted successfully');
    } catch (err: any) {
      console.error('Error deleting medication:', err);
      alert('Failed to delete medication: ' + err.message);
    } finally {
      setMedicationLoading(false);
    }
  };

  const MedicationForm = ({ patientId }: { patientId: string }) => (
    <div className="bg-gray-50 p-4 rounded-lg mt-3">
      <h6 className="text-sm font-semibold text-gray-700 mb-3">
        {editingMedication ? 'Edit Medication' : 'Add New Medication'}
      </h6>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Medication name"
          value={medicationForm.name}
          onChange={(e) => setMedicationForm({ ...medicationForm, name: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Dosage (e.g., 500mg)"
          value={medicationForm.dosage}
          onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Frequency (e.g., 3 times daily)"
          value={medicationForm.frequency}
          onChange={(e) => setMedicationForm({ ...medicationForm, frequency: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Timing (e.g., after meals)"
          value={medicationForm.timing}
          onChange={(e) => setMedicationForm({ ...medicationForm, timing: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          placeholder="Special instructions"
          value={medicationForm.instructions}
          onChange={(e) => setMedicationForm({ ...medicationForm, instructions: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
          rows={2}
        />
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => editingMedication ? handleUpdateMedication(patientId) : handleAddMedication(patientId)}
          disabled={medicationLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {medicationLoading ? 'Saving...' : (editingMedication ? 'Update' : 'Add')}
        </button>
        <button
          onClick={resetMedicationForm}
          className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-600 flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading nurse dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center text-red-600">
        <AlertCircle className="w-6 h-6 mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Nurse Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>

        {/* Hospital Info */}
        {hospitalData && (
          <div className="bg-white shadow p-6 rounded-lg">
            <div className="flex items-center mb-3">
              <Building2 className="h-5 w-5 text-purple-600 mr-2" />
              <h2 className="text-xl font-bold text-gray-800">{hospitalData.name}</h2>
            </div>
            <p className="text-sm text-gray-600">{hospitalData.address}</p>
            <p className="text-sm text-gray-600">
              <Mail className="h-4 w-4 inline mr-1" />
              {hospitalData.email}
            </p>
            <p className="text-sm text-gray-600">
              <Phone className="h-4 w-4 inline mr-1" />
              {hospitalData.phone_number}
            </p>
          </div>
        )}

        {/* Nurse Info */}
        {nurseData && (
          <div className="bg-white shadow p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Nurse Profile</h3>
            <p className='text-gray-800'>Name: {nurseData.name}</p>
            <p className='text-gray-800'>Email: {nurseData.email}</p>
            <p className='text-gray-800'>Phone: {nurseData.phone_number}</p>
            <p className='text-gray-800'>
              Shift:{' '}
              {nurseData.shift
                ? new Date(nurseData.shift).toLocaleString()
                : 'Not Assigned'}
            </p>
          </div>
        )}

        {/* Patients */}
        <div className="bg-white shadow p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">
            Assigned Patients ({patients.length})
          </h3>

          {patients.length === 0 ? (
            <p className="text-gray-500">No patients assigned.</p>
          ) : (
            patients.map((patient) => (
              <div key={patient.id} className="border-t pt-4 mt-4">
                <h4 className="text-lg font-medium text-gray-700">{patient.name}</h4>
                <p className="text-sm text-gray-600">
                  <Mail className="h-4 w-4 inline mr-1" />
                  {patient.email} &nbsp; • &nbsp;
                  <Phone className="h-4 w-4 inline mr-1" />
                  {patient.phone_number}
                </p>
                <p className="text-sm text-gray-600">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  Room: {patient.room} &nbsp; • &nbsp; Age: {patient.age} &nbsp; • &nbsp; Gender: {patient.gender}
                </p>
                <p className="text-sm text-gray-600">Diagnosis: {patient.diagnosis}</p>

                {/* Medications Section */}
                <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-semibold text-gray-700 flex items-center">
                      <Pill className="h-4 w-4 mr-1" />
                      Medications ({medications[patient.id]?.length || 0})
                    </h5>
                    <button
                      onClick={() => setShowMedicationForm(showMedicationForm === patient.id ? null : patient.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700 flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add Medication
                    </button>
                  </div>

                  {/* Medication List */}
                  {medications[patient.id]?.length ? (
                    <div className="space-y-2">
                      {medications[patient.id].map((med) => {
                        const dosageData = med.dosage || {};
                        return (
                          <div key={med.id} className="bg-white p-3 rounded border flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{med.name}</p>
                              <p className="text-sm text-gray-600">
                                <strong>Dosage:</strong> {dosageData.amount || 'Not specified'}
                              </p>
                              {dosageData.frequency && (
                                <p className="text-sm text-gray-600">
                                  <strong>Frequency:</strong> {dosageData.frequency}
                                </p>
                              )}
                              {dosageData.timing && (
                                <p className="text-sm text-gray-600">
                                  <strong>Timing:</strong> {dosageData.timing}
                                </p>
                              )}
                              {dosageData.instructions && (
                                <p className="text-sm text-gray-600">
                                  <strong>Instructions:</strong> {dosageData.instructions}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => handleEditMedication(med)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteMedication(med.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No medications assigned</p>
                  )}

                  {/* Medication Form */}
                  {showMedicationForm === patient.id && (
                    <MedicationForm patientId={patient.id} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NurseDashboard;