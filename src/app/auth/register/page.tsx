'use client';

import { useEffect, useState } from 'react';
import { Upload, User, Mail, Lock, Phone, MapPin, Calendar, Activity, Home, Camera } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';

const supabase = createClient();

export default function RegisterPage() {
  const [role, setRole] = useState('hospital');
  const [form, setForm] = useState<any>({
    name: '',
    email: '',
    password: '',
    phone_number: '',
    address: '',
    nurse_ids: [],
    patient_ids: [],
    assigned_nurse_ids: [],
    age: '',
    gender: '',
    room: '',
    diagnosis: '',
    preferred_lang: 'English',
    photo_file: null,
    photo_url: '',
    family: {},
    hospital_name_input: '',
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);

  const genderOptions = [
    { value: '', label: 'Select Gender' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' }
  ];

  const diagnosisOptions = [
    { value: '', label: 'Select Diagnosis' },
    { value: 'hypertension', label: 'Hypertension' },
    { value: 'diabetes', label: 'Diabetes' },
    { value: 'heart_disease', label: 'Heart Disease' },
    { value: 'asthma', label: 'Asthma' },
    { value: 'pneumonia', label: 'Pneumonia' },
    { value: 'covid19', label: 'COVID-19' },
    { value: 'fracture', label: 'Fracture' },
    { value: 'surgery_recovery', label: 'Surgery Recovery' },
    { value: 'cancer', label: 'Cancer' },
    { value: 'stroke', label: 'Stroke' },
    { value: 'kidney_disease', label: 'Kidney Disease' },
    { value: 'liver_disease', label: 'Liver Disease' },
    { value: 'mental_health', label: 'Mental Health' },
    { value: 'other', label: 'Other' }
  ];

  const languageOptions = [
    { value: 'English', label: 'English' },
    { value: 'Spanish', label: 'Spanish' },
    { value: 'French', label: 'French' },
    { value: 'German', label: 'German' },
    { value: 'Chinese', label: 'Chinese' },
    { value: 'Hindi', label: 'Hindi' },
    { value: 'Arabic', label: 'Arabic' }
  ];

  const handleChange = (key: string, value: any) => {
    setForm({ ...form, [key]: value });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      setForm({ ...form, photo_file: file });
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Fetch hospital list once for nurse/patient registration
  useEffect(() => {
    async function fetchHospitals() {
      const { data } = await supabase.from('hospital').select('id, name');
      if (data) {
        setHospitals(data);
      }
    }

    if (role !== 'hospital') fetchHospitals();
  }, [role]);

  const handleRegister = async () => {
    let payload = { ...form };

    if (role === 'hospital') {
      payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        address: form.address,
        phone_number: form.phone_number,
        nurse_ids: [],
        patient_ids: [],
      };
    }

    else if (role === 'nurse') {
      const match = hospitals.find(
        (h: any) => h.name.toLowerCase() === form.hospital_name_input.toLowerCase()
      );

      if (!match) {
        alert('❌ Hospital name not found!');
        return;
      }

      payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        phone_number: form.phone_number,
        hospital_id: match.id,
        alert_ids: [],
        shift: new Date().toISOString(),
        patient_ids: [],
      };
    }

    else if (role === 'patient') {
      const match = hospitals.find(
        (h: any) => h.name.toLowerCase() === form.hospital_name_input.toLowerCase()
      );

      if (!match) {
        alert('❌ Hospital name not found!');
        return;
      }

      // Upload image to Supabase Storage
      let photo_url = form.photo_url;
      if (form.photo_file) {
        const fileExt = form.photo_file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `patient_photos/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('patient-photos') // Bucket name
          .upload(filePath, form.photo_file);

        if (uploadError) {
          alert('❌ Image Upload Failed');
          return;
        }

        const { data: publicURLData } = supabase
          .storage
          .from('patient-photos')
          .getPublicUrl(filePath);

        photo_url = publicURLData?.publicUrl || '';
      }

      payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        phone_number: form.phone_number,
        age: parseInt(form.age),
        gender: form.gender,
        room: form.room,
        diagnosis: form.diagnosis,
        preferred_lang: form.preferred_lang,
        photo_url: photo_url,
        hospital_id: match.id,
        assigned_nurse_ids: [],
        family: form.family,
      };
    }

    const table =
      role === 'hospital' ? 'hospital' : role === 'nurse' ? 'nurse' : 'patients';
    const { error } = await supabase.from(table).insert([payload]);

    if (error) alert('❌ Error: ' + error.message);
    else alert('✅ Registered Successfully!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h1>
          <p className="text-gray-600">Register for your healthcare portal</p>
        </div>

        {/* Role Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="inline w-4 h-4 mr-1" />
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="hospital">Hospital</option>
            <option value="nurse">Nurse</option>
            <option value="patient">Patient</option>
          </select>
        </div>

        {/* Common Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="inline w-4 h-4 mr-1" />
              Full Name
            </label>
            <input
              type="text"
              placeholder="Enter your full name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="inline w-4 h-4 mr-1" />
              Email Address
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="inline w-4 h-4 mr-1" />
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="inline w-4 h-4 mr-1" />
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="Enter your phone number"
              value={form.phone_number}
              onChange={(e) => handleChange('phone_number', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Hospital-specific Fields */}
        {role === 'hospital' && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline w-4 h-4 mr-1" />
              Hospital Address
            </label>
            <textarea
              placeholder="Enter hospital address"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        )}

        {/* Nurse-specific Fields */}
        {role === 'nurse' && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Home className="inline w-4 h-4 mr-1" />
              Hospital
            </label>
            <select
              value={form.hospital_name_input}
              onChange={(e) => handleChange('hospital_name_input', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="">Select Hospital</option>
              {hospitals.map((hospital) => (
                <option key={hospital.id} value={hospital.name}>
                  {hospital.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Patient-specific Fields */}
        {role === 'patient' && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Age
                </label>
                <input
                  type="number"
                  placeholder="Enter age"
                  value={form.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="inline w-4 h-4 mr-1" />
                  Gender
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Home className="inline w-4 h-4 mr-1" />
                  Room Number
                </label>
                <input
                  type="text"
                  placeholder="Enter room number"
                  value={form.room}
                  onChange={(e) => handleChange('room', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Activity className="inline w-4 h-4 mr-1" />
                  Diagnosis
                </label>
                <select
                  value={form.diagnosis}
                  onChange={(e) => handleChange('diagnosis', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  {diagnosisOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Home className="inline w-4 h-4 mr-1" />
                Hospital
              </label>
              <select
                value={form.hospital_name_input}
                onChange={(e) => handleChange('hospital_name_input', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Select Hospital</option>
                {hospitals.map((hospital) => (
                  <option key={hospital.id} value={hospital.name}>
                    {hospital.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Language
              </label>
              <select
                value={form.preferred_lang}
                onChange={(e) => handleChange('preferred_lang', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Camera className="inline w-4 h-4 mr-1" />
                Profile Photo
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                {imagePreview && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-300">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Upload a profile photo (max 5MB, JPG/PNG)
              </p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleRegister}
          className="w-full mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105"
        >
          Create Account
        </button>
      </div>
    </div>
  );
}