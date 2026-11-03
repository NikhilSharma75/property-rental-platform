const PHONE_PATTERN = /^[+]?[0-9()\-.\s]{7,20}$/;

export function validateFullName(value: string): string | null {
  if (!value.trim()) return "Full name is required.";
  if (value.trim().length < 2) return "Full name must be at least 2 characters.";
  return null;
}

export function validatePhone(value: string, required = false): string | null {
  if (!value.trim()) return required ? "Phone number is required." : null;
  if (!PHONE_PATTERN.test(value.trim())) return "Enter a valid phone number.";
  return null;
}

export function validateDateOfBirth(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Enter a valid date.";
  const today = new Date();
  if (date > today) return "Date of birth can't be in the future.";
  const age = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (age < 18) return "You must be at least 18 years old.";
  if (age > 120) return "Enter a valid date of birth.";
  return null;
}

export function validateBio(value: string): string | null {
  if (value.length > 500) return "Bio must be 500 characters or fewer.";
  return null;
}

export function validatePostalCode(value: string): string | null {
  if (!value.trim()) return null;
  if (value.trim().length > 20) return "Postal code is too long.";
  return null;
}
