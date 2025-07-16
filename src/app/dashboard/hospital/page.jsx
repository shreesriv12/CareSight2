"use client";

import React, { useState, useEffect } from 'react';
import { Users, User, Phone, Mail, MapPin, Calendar, AlertCircle, Plus, X, Search, Filter, Save, Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient'; 

const Dashboard = () => {
  const [patients, setPatients] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [hospitalInfo, setHospitalInfo] = useState(null);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [error, setError] = useState(null);

  // Get hospital ID from localStorage
  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    const role = localStorage.getItem('role');
    
    if (role !== 'hospital') {
      setError('Access denied. Hospital role required.');
      setLoading(false);
      return;
    }
    
    if (userId) {
      setHospitalId(userId);
    } else {
      setError('Hospital ID not found in localStorage');
      setLoading(false);
    }
  }, []);

  // Fetch hospital info from Supabase
  const fetchHospitalInfo = async (id) => {
    try {
      const { data, error } = await createClient()
        .from('hospital')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setHospitalInfo(data);
      return data; // Return the hospital data to use in other functions
    } catch (err) {
      setError(`Error fetching hospital info: ${err.message}`);
      console.error('Error fetching hospital info:', err);
      throw err;
    }
  };

  // Fetch patients from Supabase using patient_ids from hospital
  const fetchPatients = async (patientIds) => {
    if (!patientIds || patientIds.length === 0) {
      setPatients([]);
      return;
    }
    
    try {
      const { data, error } = await createClient()
        .from('patients')
        .select('*')
        .in('id', patientIds);
      
      if (error) throw error;
      setPatients(data || []);
    } catch (err) {
      setError(`Error fetching patients: ${err.message}`);
      console.error('Error fetching patients:', err);
    }
  };

  // Fetch nurses from Supabase using nurse_ids from hospital
  const fetchNurses = async (nurseIds) => {
    if (!nurseIds || nurseIds.length === 0) {
      setNurses([]);
      return;
    }
    
    try {
      const { data, error } = await createClient()
        .from('nurse')
        .select('*')
        .in('id', nurseIds);
      
      if (error) throw error;
      setNurses(data || []);
    } catch (err) {
      setError(`Error fetching nurses: ${err.message}`);
      console.error('Error fetching nurses:', err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (hospitalId) {
      const fetchData = async () => {
        setLoading(true);
        try {
          // First fetch hospital info
          const hospitalData = await fetchHospitalInfo(hospitalId);
          
          // Then fetch patients and nurses using the IDs from hospital data
          await Promise.all([
            fetchPatients(hospitalData.patient_ids || []),
            fetchNurses(hospitalData.nurse_ids || [])
          ]);
        } catch (err) {
          console.error('Error fetching data:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [hospitalId]);

  // Assign patient to nurse
  const assignPatientToNurse = async (patientId, nurseId) => {
    try {
      const patient = patients.find(p => p.id === patientId);
      const nurse = nurses.find(n => n.id === nurseId);
      
      if (!patient || !nurse) {
        throw new Error('Patient or nurse not found');
      }

      // Update patient's assigned_nurse_ids
      const updatedPatientNurseIds = patient.assigned_nurse_ids || [];
      if (!updatedPatientNurseIds.includes(nurseId)) {
        updatedPatientNurseIds.push(nurseId);
      }

      const { error: patientError } = await createClient()
        .from('patients')
        .update({ assigned_nurse_ids: updatedPatientNurseIds })
        .eq('id', patientId);

      if (patientError) throw patientError;

      // Update nurse's patient_ids
      const updatedNursePatientIds = nurse.patient_ids || [];
      if (!updatedNursePatientIds.includes(patientId)) {
        updatedNursePatientIds.push(patientId);
      }

      const { error: nurseError } = await createClient()
        .from('nurse')
        .update({ patient_ids: updatedNursePatientIds })
        .eq('id', nurseId);

      if (nurseError) throw nurseError;

      // Refresh data
      const hospitalData = await fetchHospitalInfo(hospitalId);
      await Promise.all([
        fetchPatients(hospitalData.patient_ids || []),
        fetchNurses(hospitalData.nurse_ids || [])
      ]);
      
      setShowAssignModal(false);
      setSelectedPatient(null);
      setSelectedNurse(null);
      
      // Success message
      alert('Patient successfully assigned to nurse!');
    } catch (err) {
      setError(`Error assigning patient: ${err.message}`);
      console.error('Error assigning patient:', err);
    }
  };

  // Remove patient from nurse
  const removePatientFromNurse = async (patientId, nurseId) => {
    try {
      const patient = patients.find(p => p.id === patientId);
      const nurse = nurses.find(n => n.id === nurseId);
      
      if (!patient || !nurse) {
        throw new Error('Patient or nurse not found');
      }

      // Update patient's assigned_nurse_ids
      const updatedPatientNurseIds = (patient.assigned_nurse_ids || []).filter(id => id !== nurseId);
      
      const { error: patientError } = await createClient()
        .from('patients')
        .update({ assigned_nurse_ids: updatedPatientNurseIds })
        .eq('id', patientId);

      if (patientError) throw patientError;

      // Update nurse's patient_ids
      const updatedNursePatientIds = (nurse.patient_ids || []).filter(id => id !== patientId);
      
      const { error: nurseError } = await createClient()
        .from('nurse')
        .update({ patient_ids: updatedNursePatientIds })
        .eq('id', nurseId);

      if (nurseError) throw nurseError;

      // Refresh data
      const hospitalData = await fetchHospitalInfo(hospitalId);
      await Promise.all([
        fetchPatients(hospitalData.patient_ids || []),
        fetchNurses(hospitalData.nurse_ids || [])
      ]);
      
      // Success message
      alert('Patient successfully removed from nurse!');
    } catch (err) {
      setError(`Error removing assignment: ${err.message}`);
      console.error('Error removing assignment:', err);
    }
  };

  // Get nurse name by ID
  const getNurseNameById = (nurseId) => {
    const nurse = nurses.find(n => n.id === nurseId);
    return nurse ? nurse.name : 'Unknown Nurse';
  };

  // Get patient name by ID
  const getPatientNameById = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? patient.name : 'Unknown Patient';
  };

  // Filter patients based on search and filter
  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.room.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterBy === 'all') return matchesSearch;
    if (filterBy === 'assigned') return matchesSearch && patient.assigned_nurse_ids && patient.assigned_nurse_ids.length > 0;
    if (filterBy === 'unassigned') return matchesSearch && (!patient.assigned_nurse_ids || patient.assigned_nurse_ids.length === 0);
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-700 mb-2">Error</h1>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Hospital Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">Manage patient assignments and nurse workloads</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-blue-50 px-4 py-2 rounded-lg">
                <span className="text-sm font-medium text-blue-600">Total Patients: {patients.length}</span>
              </div>
              <div className="bg-green-50 px-4 py-2 rounded-lg">
                <span className="text-sm font-medium text-green-600">Total Nurses: {nurses.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hospital Info */}
        {hospitalInfo && (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <div className="flex items-center mb-4">
              <Building2 className="h-6 w-6 text-purple-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">{hospitalInfo.name}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                {hospitalInfo.address}
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                {hospitalInfo.email}
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                {hospitalInfo.phone_number}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Patients Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Patients
                  </h2>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Patient
                  </button>
                </div>
                
                {/* Search and Filter */}
                <div className="flex space-x-4 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search patients..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Patients</option>
                    <option value="assigned">Assigned</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                </div>
              </div>

              <div className="divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <div key={patient.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{patient.name}</h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Mail className="h-4 w-4 mr-1" />
                              {patient.email}
                            </span>
                            <span className="flex items-center">
                              <Phone className="h-4 w-4 mr-1" />
                              {patient.phone_number}
                            </span>
                            <span className="flex items-center">
                              <MapPin className="h-4 w-4 mr-1" />
                              Room {patient.room}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">
                          Age: {patient.age} • {patient.gender}
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {patient.diagnosis}
                        </div>
                      </div>
                    </div>
                    
                    {/* Assigned Nurses */}
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Assigned Nurses:</p>
                      {patient.assigned_nurse_ids && patient.assigned_nurse_ids.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {patient.assigned_nurse_ids.map((nurseId) => (
                            <span
                              key={nurseId}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                            >
                              {getNurseNameById(nurseId)}
                              <button
                                onClick={() => removePatientFromNurse(patient.id, nurseId)}
                                className="ml-2 text-green-600 hover:text-green-800"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-red-600">No nurse assigned</span>
                      )}
                    </div>
                    
                    {/* Family Contact */}
                    {patient.family && (
                      <div className="mt-2 text-sm text-gray-500">
                        Emergency Contact: {patient.family.emergency_contact} ({patient.family.relationship})
                      </div>
                    )}
                  </div>
                ))}
                
                {filteredPatients.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    No patients found matching your search criteria.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nurses Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Nurses
                </h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {nurses.map((nurse) => (
                  <div key={nurse.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{nurse.name}</h3>
                        <div className="text-sm text-gray-500 space-y-1">
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-1" />
                            {nurse.email}
                          </div>
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-1" />
                            {nurse.phone_number}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Assigned Patients */}
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Assigned Patients ({nurse.patient_ids ? nurse.patient_ids.length : 0}):
                      </p>
                      {nurse.patient_ids && nurse.patient_ids.length > 0 ? (
                        <div className="space-y-1">
                          {nurse.patient_ids.map((patientId) => (
                            <div key={patientId} className="text-sm text-gray-600 flex items-center justify-between">
                              <span>{getPatientNameById(patientId)}</span>
                              <button
                                onClick={() => removePatientFromNurse(patientId, nurse.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No patients assigned</span>
                      )}
                    </div>
                    
                    {/* Shift Information */}
                    <div className="mt-3 text-sm text-gray-500">
                      <Calendar className="h-4 w-4 inline mr-1" />
                      Shift: {new Date(nurse.shift).toLocaleString()}
                    </div>
                  </div>
                ))}
                
                {nurses.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    No nurses found in this hospital.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Assign Patient to Nurse</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
                <select
                  value={selectedPatient || ''}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a patient...</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} - Room {patient.room}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Nurse</label>
                <select
                  value={selectedNurse || ''}
                  onChange={(e) => setSelectedNurse(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a nurse...</option>
                  {nurses.map((nurse) => (
                    <option key={nurse.id} value={nurse.id}>
                      {nurse.name} - {nurse.patient_ids ? nurse.patient_ids.length : 0} patients
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => assignPatientToNurse(selectedPatient, selectedNurse)}
                disabled={!selectedPatient || !selectedNurse}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;