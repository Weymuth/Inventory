function getInventoryUser_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) throw new Error('Google did not provide your signed-in email address. Use your Mercersburg account and try again.');

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (!sheet) throw new Error('USERS sheet not found.');

  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('USERS sheet is empty.');

  const header = headerMap_(values[0]);
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const rowEmail = String(row[header.Email] || '').trim().toLowerCase();
    if (rowEmail !== email) continue;

    const active = row[header.Active] === true || String(row[header.Active]).toUpperCase() === 'TRUE';
    if (!active) throw new Error('Your inventory account is inactive.');

    return {
      userId: String(row[header.UserID] || ''),
      email: email,
      studentId: String(row[header.StudentID] || ''),
      firstName: String(row[header.FirstName] || ''),
      lastName: String(row[header.LastName] || ''),
      role: String(row[header.Role] || '').trim().toUpperCase(),
      barcode: String(row[header.Barcode] || '')
    };
  }

  throw new Error('Your Google account is not listed in the USERS sheet.');
}

function requireInventoryUser_() {
  return getInventoryUser_();
}

function requireTeacherOrAdmin_() {
  const user = getInventoryUser_();
  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    throw new Error('Teacher or admin permission is required for this inventory change.');
  }
  return user;
}

function publicUser_(user) {
  return {
    userId: user.userId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role
  };
}

function headerMap_(headers) {
  const map = {};
  headers.forEach((name, index) => { map[String(name).trim()] = index; });
  return map;
}
