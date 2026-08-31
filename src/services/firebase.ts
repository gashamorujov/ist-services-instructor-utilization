import { getApp, getApps, initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyBQdr-qS7Awg6u6rIj1Z-VHe-Qsm2JkDPw',
  authDomain: 'sertifikatqeydiyyati.firebaseapp.com',
  databaseURL: 'https://sertifikatqeydiyyati-default-rtdb.firebaseio.com',
  projectId: 'sertifikatqeydiyyati',
  storageBucket: 'sertifikatqeydiyyati.firebasestorage.app',
  messagingSenderId: '778034565258',
  appId: '1:778034565258:web:d046f0041f088f9e90dd73',
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const db = getDatabase(app)
