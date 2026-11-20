/**
 * HomeGuru Firebase Configuration & Modular Service Layer
 * Supports:
 * - Firebase Authentication (Google Sign-In, Email/Password, WhatsApp OTP)
 * - Cloud Firestore (Real-time student & educator profiles, session bookings)
 * - Firebase Storage (10th/12th marksheets, degree certificates, government ID scans)
 */

(function () {
  // 1. Firebase Project Config for HomeGuru (homeguru-5b281)
  const defaultFirebaseConfig = {
    apiKey: "AIzaSyDummyKeyReplaceWithYourActualFirebaseApiKey",
    authDomain: "homeguru-5b281.firebaseapp.com",
    databaseURL: "https://homeguru-5b281-default-rtdb.firebaseio.com",
    projectId: "homeguru-5b281",
    storageBucket: "homeguru-5b281.appspot.com",
    messagingSenderId: "109876543210",
    appId: "1:109876543210:web:homeguru5b281"
  };

  // Allow custom override saved in localStorage
  let savedConfig = null;
  try {
    const raw = localStorage.getItem('homeguru_firebase_config');
    if (raw) savedConfig = JSON.parse(raw);
  } catch (e) {
    console.warn('[Firebase] Could not parse stored custom config:', e);
  }

  const firebaseConfig = savedConfig || window.__FIREBASE_CONFIG__ || defaultFirebaseConfig;

  let app = null;
  let auth = null;
  let db = null;
  let rtdb = null;
  let storage = null;
  let googleProvider = null;
  let isRealFirebaseActive = false;

  // 2. Initialize Firebase SDK if available
  try {
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      if (!firebase.apps || firebase.apps.length === 0) {
        app = firebase.initializeApp(firebaseConfig);
      } else {
        app = firebase.app();
      }

      if (firebase.auth) {
        auth = firebase.auth();
        googleProvider = new firebase.auth.GoogleAuthProvider();
      }

      if (firebase.database) {
        rtdb = firebase.database();
      }

      if (firebase.firestore) {
        db = firebase.firestore();
      }

      if (firebase.storage) {
        storage = firebase.storage();
      }

      // Check if user set non-dummy keys
      if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('DummyKey')) {
        isRealFirebaseActive = true;
        console.log('🔥 [Firebase] Live Firebase initialized for project:', firebaseConfig.projectId);
      } else {
        console.log('⚡ [Firebase] Firebase initialized in Local Sandbox mode. Ready for live credentials.');
      }
    }
  } catch (err) {
    console.warn('[Firebase] Initialization notice:', err.message);
  }

  // 3. HomeGuru Firebase API Services
  const HomeGuruFirebase = {
    config: firebaseConfig,
    isRealActive: isRealFirebaseActive,
    app: app,
    auth: auth,
    db: db,
    rtdb: rtdb,
    storage: storage,

    // Check if live keys are present
    isConfigured: function () {
      return isRealFirebaseActive && !firebaseConfig.apiKey.includes('DummyKey');
    },

    // Save live credentials from UI
    updateConfig: function (newConfig) {
      localStorage.setItem('homeguru_firebase_config', JSON.stringify(newConfig));
      window.location.reload();
    },

    // Sign In with Google
    signInWithGoogle: async function () {
      if (this.isConfigured() && auth && googleProvider) {
        try {
          googleProvider.setCustomParameters({ prompt: 'select_account' });
          const result = await auth.signInWithPopup(googleProvider);
          const user = result.user;
          const studentProfile = {
            uid: user.uid,
            name: user.displayName || 'Aryan Sharma',
            email: user.email,
            avatar: user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
            role: 'student',
            grade: 'Class 12',
            city: 'Jaipur',
            lastLogin: new Date().toISOString()
          };

          // Sync with Realtime Database
          if (rtdb) {
            try {
              await rtdb.ref('students/' + user.uid).update(studentProfile);
            } catch (rErr) {
              console.warn('[Firebase RTDB] student sync notice:', rErr);
            }
          }

          // Sync with Cloud Firestore
          if (db) {
            try {
              await db.collection('students').doc(user.uid).set(studentProfile, { merge: true });
            } catch (fErr) {
              console.warn('[Firebase Firestore] student sync notice:', fErr);
            }
          }

          localStorage.setItem('homeguru_current_user', JSON.stringify(studentProfile));
          return { success: true, user: studentProfile, isLive: true };
        } catch (error) {
          console.error('[Firebase] Google sign-in error:', error);
          throw error;
        }
      } else {
        // Fallback local mode
        const mockStudent = {
          name: 'Aryan Sharma',
          email: 'aryan.sharma@gmail.com',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
          role: 'student',
          grade: 'Class 12 (JEE Main Aspirant)',
          city: 'Jaipur'
        };
        localStorage.setItem('homeguru_current_user', JSON.stringify(mockStudent));
        return { success: true, user: mockStudent, mode: 'local' };
      }
    },

    // Student Sign Up with Email/Password
    signUpStudent: async function (email, password, name, grade, city) {
      if (this.isConfigured() && auth) {
        try {
          const cred = await auth.createUserWithEmailAndPassword(email, password);
          const studentProfile = {
            uid: cred.user.uid,
            name: name,
            email: email,
            role: 'student',
            grade: grade || 'Class 12',
            city: city || 'Jaipur',
            createdAt: new Date().toISOString()
          };

          // Save to Cloud Firestore
          if (db) {
            await db.collection('students').doc(cred.user.uid).set(studentProfile);
          }

          localStorage.setItem('homeguru_current_user', JSON.stringify(studentProfile));
          return { success: true, user: studentProfile };
        } catch (error) {
          console.error('[Firebase] Signup error:', error);
          throw error;
        }
      } else {
        // Local mode fallback
        const studentProfile = {
          name: name || 'Aryan Sharma',
          email: email || 'aryan.sharma@gmail.com',
          role: 'student',
          grade: grade || 'Class 12',
          city: city || 'Jaipur'
        };
        localStorage.setItem('homeguru_current_user', JSON.stringify(studentProfile));
        return { success: true, user: studentProfile, mode: 'local' };
      }
    },

    // Student Login with Email/Password
    signInStudent: async function (email, password) {
      if (this.isConfigured() && auth) {
        try {
          const cred = await auth.signInWithEmailAndPassword(email, password);
          let profile = {
            uid: cred.user.uid,
            email: cred.user.email,
            name: cred.user.displayName || 'Aryan Sharma',
            role: 'student'
          };

          if (db) {
            const doc = await db.collection('students').doc(cred.user.uid).get();
            if (doc.exists) {
              profile = { ...profile, ...doc.data() };
            }
          }

          localStorage.setItem('homeguru_current_user', JSON.stringify(profile));
          return { success: true, user: profile };
        } catch (error) {
          console.error('[Firebase] Login error:', error);
          throw error;
        }
      } else {
        // Local mode fallback
        const profile = {
          name: 'Aryan Sharma',
          email: email,
          role: 'student',
          grade: 'Class 12',
          city: 'Jaipur'
        };
        localStorage.setItem('homeguru_current_user', JSON.stringify(profile));
        return { success: true, user: profile, mode: 'local' };
      }
    },

    // Upload Document to Firebase Cloud Storage
    uploadDocument: async function (file, path) {
      if (this.isConfigured() && storage) {
        try {
          const storageRef = storage.ref().child(path + '/' + Date.now() + '_' + file.name);
          const snapshot = await storageRef.put(file);
          const downloadURL = await snapshot.ref.getDownloadURL();
          return { success: true, url: downloadURL, name: file.name, size: file.size };
        } catch (err) {
          console.error('[Firebase] Storage upload error:', err);
          throw err;
        }
      } else {
        // Return local data URL or blob URL preview
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              success: true,
              url: e.target.result,
              name: file.name,
              size: file.size,
              mode: 'local'
            });
          };
          reader.readAsDataURL(file);
        });
      }
    },

    // Save Educator Verification Profile to Firestore
    saveEducatorProfile: async function (profileData) {
      if (this.isConfigured() && db) {
        try {
          const docRef = db.collection('educators').doc(profileData.id || 'HG-TEACH-8492');
          await docRef.set({
            ...profileData,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          return { success: true };
        } catch (err) {
          console.error('[Firebase] Firestore educator save error:', err);
          throw err;
        }
      } else {
        localStorage.setItem('homeguru_teacher_profile', JSON.stringify(profileData));
        return { success: true, mode: 'local' };
      }
    },

    // Auth State Observer
    onAuthStateChanged: function (callback) {
      if (auth) {
        return auth.onAuthStateChanged(callback);
      }
      return null;
    }
  };

  // Expose globally
  window.HomeGuruFirebase = HomeGuruFirebase;
})();
