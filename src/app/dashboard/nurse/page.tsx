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
  medicine_name: string;
  dosage: string;
  timing: string;
};

const NurseDashboard: React.FC = () => {
  const [nurseData, setNurseData] = useState<Nurse | null>(null);
  const [hospitalData, setHospitalData] = useState<Hospital | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medications, setMedications] = useState<Record<string, Medication[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // const { data: nurse, error: nurseError } = await supabase
        //   .from('nurse')
        //   .select('*')
        //   .eq('auth_user_id', userId)
        //   .single();

        const handleLogout = async () => {
  try {
    await supabase.auth.signOut();
    localStorage.removeItem('user_id');
    localStorage.removeItem('role');
    window.location.href = '/'; // redirect to login or homepage
  } catch (err) {
    console.error('Logout failed:', err);
  }
};

         const { data: nurse,error: nurseError } = await createClient()
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
        const { data: meds, error: medError } = await supabase
          .from('medication')
          .select('*')
          .in('patient_id', nurse.patient_ids || []);

        if (medError) throw medError;

        const medMap: Record<string, Medication[]> = {};
        for (const med of meds || []) {
          if (!medMap[med.patient_id]) medMap[med.patient_id] = [];
          medMap[med.patient_id].push(med);
        }

        setMedications(medMap);
      } catch (err: any) {
        console.error('Error loading dashboard:', err);
        setError(err.message || 'Unexpected error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
            onClick={() => {
              localStorage.removeItem('user_id');
              localStorage.removeItem('role');
              window.location.href = '/'; // Redirect to login or homepage
            }}
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

                {/* Medications */}
                <div className="mt-2">
                  <h5 className="text-sm font-semibold text-gray-700 mb-1 flex items-center">
                    <Pill className="h-4 w-4 mr-1" />
                    Medications
                  </h5>
                  {medications[patient.id]?.length ? (
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {medications[patient.id].map((med) => (
                        <li key={med.id}>
                          {med.medicine_name} - {med.dosage} - {med.timing}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No medications assigned</p>
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
