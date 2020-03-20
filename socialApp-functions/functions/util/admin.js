const admin = require('firebase-admin');
const serviceAccount = require("../socialape-74003-firebase-adminsdk-anr9k-f617b24ee1.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://socialape-74003.firebaseio.com"
});

const db = admin.firestore();

module.exports = { admin, db };