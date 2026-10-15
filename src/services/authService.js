import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { assertClientWriteAllowed } from "../config/firebaseEnvironment.mjs";
import { auth } from "../firebase/firebaseConfig";
import { acceptLegalTerms } from "./legalService";

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Registro en curso (SPEC 024, 5.4). onAuthStateChanged dispara antes de que
// createUserWithEmailAndPassword resuelva, así que el deferred se crea de
// forma síncrona antes de crear la cuenta. Nunca rechaza.
let pendingRegistrationSetup = null;

export function waitForRegistrationSetup() {
  return pendingRegistrationSetup || Promise.resolve();
}

export async function registerWithEmail(
  email,
  password,
  { legalTermsAccepted = false } = {}
) {
  assertClientWriteAllowed("crear cuentas");
  if (legalTermsAccepted !== true) {
    throw new Error("auth/legal-terms-required");
  }

  let finishSetup;
  const setup = new Promise((resolve) => {
    finishSetup = resolve;
  });
  pendingRegistrationSetup = setup;

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    try {
      await acceptLegalTerms();
    } catch (error) {
      // No bloquea el registro: el guard de aceptación la pedirá al ingresar.
      console.error("No se pudo registrar la aceptación legal:", error);
    }
    // La sesión no necesita esperar al correo de verificación.
    finishSetup();

    try {
      await sendVerificationEmail(credential.user);
    } catch (error) {
      console.warn("No se pudo enviar el correo de verificacion:", error);
    }

    return credential;
  } finally {
    if (pendingRegistrationSetup === setup) pendingRegistrationSetup = null;
    finishSetup();
  }
}

export async function resetPassword(email) {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) {
    throw new Error("auth/email-required");
  }

  return sendPasswordResetEmail(auth, normalizedEmail);
}

export async function sendVerificationEmail(user = auth.currentUser) {
  if (!user) {
    throw new Error("auth/no-current-user");
  }

  if (user.emailVerified) {
    return false;
  }

  await firebaseSendEmailVerification(user);
  return true;
}

export async function refreshCurrentUser() {
  const user = auth.currentUser;
  if (!user) return null;

  await user.reload();
  return auth.currentUser;
}

export function logout() {
  return signOut(auth);
}
