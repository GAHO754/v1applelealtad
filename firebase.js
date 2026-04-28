// firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyDudE8w4AZx9o3sB3pdaVFQah1GeIGJI3M",
  authDomain: "applev1demo.firebaseapp.com",
  projectId: "applev1demo",
  storageBucket: "applev1demo.firebasestorage.app",
  messagingSenderId: "1046800874782",
  appId: "1:1046800874782:web:11ce7b86b406035808dd0f",
  measurementId: "G-SC03N02S0R"
};
// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
// Servicios Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Analytics opcional
if (firebase.analytics) {
  firebase.analytics();
}