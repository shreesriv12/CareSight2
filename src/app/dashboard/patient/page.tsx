'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import {
  Mail,
  Phone,
  Building2,
  User,
  Edit2,
  Trash2,
  Plus,
  AlertCircle,
  Heart,
} from 'lucide-react';

const PatientDashboard: React.FC = () => {
  const supabase = createClient();

  const [patientData, setPatientData] = useState<any>(null);
  const [hospitalData, setHospitalData] = useState<any>(null);
  const [nurseData, setNurseData] = useState<any>(null);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [newFamilyMember, setNewFamilyMember] = useState({
  name: '',
  email: '',
  address: '',
  phone_number: '',
  relationship: '',
  is_emergency_contact: false,
});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = localStorage.getItem('user_id');
        const role = localStorage.getItem('role');

        if (role !== 'patients') {
          setError('Access denied. Patient role required.');
          console.log(role);
          setLoading(false);
          return;
        }

        const { data: patient, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('id', userId)
          .single();

        if (patientError || !patient) throw new Error('Patient data not found.');
        setPatientData(patient);
        setPhone(patient.phone_number);
        setAge(patient.age);

        // Fetch hospital
        const { data: hospital } = await supabase
          .from('hospital')
          .select('*')
          .eq('id', patient.hospital_id)
          .single();
        setHospitalData(hospital);

        // Fetch nurse
        const { data: nurse } = await supabase
          .from('nurse')
          .select('*')
          .eq('id', patient.assigned_nurse_ids)
          .single();
        setNurseData(nurse);

        // Fetch family members
        // const { data: family } = await supabase
        //   .from('family')
        //   .select('*')
        //   .eq('patient_id', patient.id);

        
  const { data:family } = await supabase
        
        .from('patients')
        .select('*')
        .eq('id', patient.id)
        .single();

        console.log(family);
        setFamilyMembers(family.family || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleUpdate = async () => {
    const { error } = await supabase
      .from('patients')
      .update({ phone_number: phone, age })
      .eq('id', patientData.id);

    if (!error) {
      setPatientData({ ...patientData, phone_number: phone, age });
      setEditing(false);
    }
  };

 const handleAddFamily = async () => {
  if (
    !newFamilyMember.name.trim() ||
    !newFamilyMember.email.trim()
  ) {
    alert('Name and email are required.');
    return;
  }

  // Use current UI state (familyMembers) instead of stale patientData.family
  const updatedFamily = [...familyMembers, newFamilyMember];

  const { error } = await supabase
    .from('patients')
    .update({ family: updatedFamily })
    .eq('id', patientData.id);

  if (!error) {
    setFamilyMembers(updatedFamily); // update local UI state
    setNewFamilyMember({
      name: '',
      email: '',
      address: '',
      phone_number: '',
      relationship: '',
      is_emergency_contact: false,
    });
  } else {
    console.error('Error updating family:', error);
  }
};

const handleDeleteFamily = async (index: number) => {
  const updated = [...familyMembers];
  updated.splice(index, 1);

  const { error } = await supabase
    .from('patients')
    .update({ family: updated })
    .eq('id', patientData.id);

  if (!error) {
    setFamilyMembers(updated);
  } else {
    console.error('Error deleting family member:', error);
  }
};

  const handleCaresightRedirect = () => {
    // You can change this URL to your actual Caresight page
    window.location.href = '/caresight-verse';
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user_id');
    localStorage.removeItem('role');
    window.location.href = '/';
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading patient dashboard...</p>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        <AlertCircle className="mr-2" />
        {error}
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Patient Dashboard</h1>
          <div className="flex space-x-3">
            <button
              onClick={handleCaresightRedirect}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 flex items-center space-x-2 shadow-lg"
            >
              <Heart className="h-4 w-4" />
              <span>Enter the Verse of Caresight</span>
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Hospital Info */}
        {hospitalData && (
          <div className="bg-white p-5 rounded shadow">
            <h2 className="text-xl font-semibold mb-2  text-gray-900 flex items-center">
              <Building2 className="h-5 text-gray-900 w-5 mr-2" />
              {hospitalData.name}
            </h2>
            <p className="text-sm text-gray-800">{hospitalData.address}</p>
            <p className="text-sm text-gray-800">
              <Mail className="h-4 w-4 inline mr-1" />
              {hospitalData.email}
            </p>
            <p className="text-sm text-gray-800">
              <Phone className="h-4 w-4 inline mr-1" />
              {hospitalData.phone_number}
            </p>
          </div>
        )}

        {/* Nurse Info */}
        {nurseData ? (
  <div className="bg-white p-5 rounded shadow">
    <h2 className="text-lg  text-gray-900 font-semibold mb-1">Assigned Nurse</h2>
    <p className="text-gray-700">Name: {nurseData.name}</p>
    <p className="text-gray-700">Email: {nurseData.email}</p>
    <p className="text-gray-700">Phone: {nurseData.phone_number}</p>
  </div>
) : (
  <div className="bg-white p-5 rounded shadow">
    <h2 className="text-lg font-semibold text-red-500 mb-1">No Nurse Assigned</h2>
  </div>
)}

        {/* Patient Info */}
        <div className="bg-white p-5 rounded shadow space-y-2">
          <h2 className="text-lg text-gray-800 font-semibold">Your Info</h2>
          <p className='text-gray-900'>Name: {patientData.name}</p>
          {editing ? (
            <>
              <input
                type="number"
                className="border p-2 w-full className='text-gray-900'"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Age"
              />
              <input
                type="text"
                className="border p-2 w-full mt-2 className='text-gray-900'"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number"
              />
              <div className="mt-2">
                <button
                  className="bg-green-600 text-white px-4 py-1 rounded mr-2"
                  onClick={handleUpdate}
                >
                  Save
                </button>
                <button
                  className="bg-gray-400 text-white px-4 py-1 rounded"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p  className='text-gray-800'>Age: {patientData.age}</p>
              <p  className='text-gray-800'>Age: {patientData.age}</p>
              <p className='text-gray-800'>Phone: {patientData.phone_number}</p>
              <button
                className="mt-2 bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                onClick={() => setEditing(true)}
              >
                <Edit2 className="inline h-4 w-4 mr-1" /> Edit Info
              </button>
            </>
          )}
        </div>

        {/* Family Members */}
      <div className="bg-white p-6 rounded-lg shadow">
  <h2 className="text-xl font-semibold mb-4 text-gray-800">Family Members</h2>

  {familyMembers.length > 0 ? (
    <div className="space-y-4">
      {familyMembers.map((member, index) => (
        <div
          key={index}
          className="border p-4 rounded bg-gray-50 flex justify-between items-start"
        >
          <div className="text-sm text-gray-800 space-y-1">
            <p><strong>Name:</strong> {member.name}</p>
            <p><strong>Email:</strong> {member.email}</p>
            <p><strong>Phone:</strong> {member.phone_number}</p>
            <p><strong>Relationship:</strong> {member.relationship}</p>
            <p><strong>Emergency Contact:</strong> {member.is_emergency_contact ? 'Yes' : 'No'}</p>
          </div>
          <button
            onClick={() => handleDeleteFamily(index)}
            className="text-red-600 text-sm hover:underline"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  ) : (
    <>
      <p className="text-gray-600 mb-4">No family members added yet. Add one below:</p>
      <div className="space-y-2">
        <input
          type="text"
          value={newFamilyMember.name}
          onChange={(e) => setNewFamilyMember({ ...newFamilyMember, name: e.target.value })}
          placeholder="Name"
          className="w-full border p-2 rounded"
        />
        <input
          type="email"
          value={newFamilyMember.email}
          onChange={(e) => setNewFamilyMember({ ...newFamilyMember, email: e.target.value })}
          placeholder="Email"
          className="w-full border p-2 rounded"
        />
        <input
          type="text"
          value={newFamilyMember.phone_number}
          onChange={(e) => setNewFamilyMember({ ...newFamilyMember, phone_number: e.target.value })}
          placeholder="Phone Number"
          className="w-full border p-2 rounded"
        />
        <input
          type="text"
          value={newFamilyMember.relationship}
          onChange={(e) => setNewFamilyMember({ ...newFamilyMember, relationship: e.target.value })}
          placeholder="Relationship"
          className="w-full border p-2 rounded"
        />
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={newFamilyMember.is_emergency_contact}
            onChange={(e) =>
              setNewFamilyMember({ ...newFamilyMember, is_emergency_contact: e.target.checked })
            }
            className="mr-2"
          />
          Emergency Contact
        </label>
        <button
          onClick={handleAddFamily}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Family Member
        </button>
      </div>
    </>
  )}
</div>

        </div>
      </div>
    
  );
};

export default PatientDashboard;