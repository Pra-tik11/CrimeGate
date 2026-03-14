require('dotenv').config();

// ── Colors ──
const g = '\x1b[32m', r = '\x1b[31m', y = '\x1b[33m',
      c = '\x1b[36m', w = '\x1b[37m', b = '\x1b[34m',
      rst = '\x1b[0m', bold = '\x1b[1m';

const BASE    = `http://localhost:${process.env.PORT || 3000}`;
let   passed  = 0;
let   failed  = 0;
let   userToken    = '';
let   officerToken = '';
let   adminToken   = '';
let   complaintId  = '';

// ── Fetch Wrapper ─────────────────────────────
async function req(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ── Test Helper ───────────────────────────────
async function test(name, fn) {
  try {
    const result = await fn();
    if (result) {
      console.log(`${g}  ✅ PASS${rst} — ${w}${name}${rst}`);
      passed++;
    } else {
      console.log(`${r}  ❌ FAIL${rst} — ${w}${name}${rst}`);
      failed++;
    }
  } catch(e) {
    console.log(`${r}  ❌ ERROR${rst} — ${w}${name}${rst} → ${e.message}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${bold}${b}  ──── ${title} ────${rst}`);
}

// ══════════════════════════════════════════════
//  TEST SUITES
// ══════════════════════════════════════════════
async function runTests() {
  console.log(`\n${bold}\x1b[35m${'═'.repeat(55)}${rst}`);
  console.log(`${bold}${w}  CrimeGate API Test Suite${rst}`);
  console.log(`${bold}\x1b[35m${'═'.repeat(55)}${rst}\n`);
  console.log(`${c}  Base URL: ${BASE}${rst}\n`);

  // ════════════════════════════════
  //  SERVER HEALTH
  // ════════════════════════════════
  section('Server Health');

  await test('Server is reachable', async () => {
    const res = await fetch(BASE + '/');
    return res.status === 200;
  });

  await test('404 for unknown route', async () => {
    const { status } = await req('GET', '/api/nonexistent-route-xyz');
    return status === 404;
  });

  // ════════════════════════════════
  //  USER AUTH
  // ════════════════════════════════
  section('User Authentication');

  await test('Register — missing fields returns 400', async () => {
    const { status } = await req('POST', '/api/users/register', { name: 'Test' });
    return status === 400;
  });

  await test('Register — new user success', async () => {
    const { status, data } = await req('POST', '/api/users/register', {
      name:     'Test User Seed',
      email:    `testuser_${Date.now()}@test.com`,
      password: 'Test@123',
      phone:    '9999999999'
    });
    return status === 201 && data.token;
  });

  await test('Login — invalid credentials returns 401', async () => {
    const { status } = await req('POST', '/api/users/login', {
      email: 'wrong@test.com', password: 'wrongpass'
    });
    return status === 401;
  });

  await test('Login — valid user credentials', async () => {
    const { status, data } = await req('POST', '/api/users/login', {
      email: 'pratik@example.com', password: 'Test@123'
    });
    if (status === 200 && data.token) {
      userToken = data.token;
      return true;
    }
    return false;
  });

  await test('Get user profile — with token', async () => {
    const { status, data } = await req('GET', '/api/users/profile', null, userToken);
    return status === 200 && data.name;
  });

  await test('Get user profile — without token returns 401', async () => {
    const { status } = await req('GET', '/api/users/profile');
    return status === 401;
  });

  // ════════════════════════════════
  //  COMPLAINTS
  // ════════════════════════════════
  section('Complaint Management');

  await test('File complaint — auth required', async () => {
    const { status } = await req('POST', '/api/complaints');
    return status === 401;
  });

  await test('File complaint — missing fields returns 400', async () => {
    const { status } = await req('POST', '/api/complaints',
      { title: 'Test' }, userToken);
    return status === 400;
  });

  await test('File complaint — success', async () => {
    const { status, data } = await req('POST', '/api/complaints', {
      title:       'Test API Complaint',
      description: 'This is a test complaint filed via API test suite.',
      location:    'Test Location, Pune'
    }, userToken);
    if (status === 201 && data._id) {
      complaintId = data._id;
      return true;
    }
    return false;
  });

  await test('Get my complaints — returns array', async () => {
    const { status, data } = await req('GET', '/api/complaints/my', null, userToken);
    return status === 200 && Array.isArray(data);
  });

  await test('Track complaint — valid ID', async () => {
    if (!complaintId) return false;
    const { status, data } = await req('GET',
      `/api/complaints/track/${complaintId}`, null, userToken);
    return status === 200 && data._id;
  });

  await test('Track complaint — invalid ID format returns 404', async () => {
    const { status } = await req('GET',
      '/api/complaints/track/invalidid999', null, userToken);
    return status === 404;
  });

  // ════════════════════════════════
  //  OFFICER AUTH
  // ════════════════════════════════
  section('Officer Authentication');

  await test('Officer login — missing fields returns 400', async () => {
    const { status } = await req('POST', '/api/officers/login', { badgeId: 'MH-1001' });
    return status === 400;
  });

  await test('Officer login — wrong badge returns 401', async () => {
    const { status } = await req('POST', '/api/officers/login', {
      badgeId: 'WRONG-999', password: 'wrongpass'
    });
    return status === 401;
  });

  await test('Officer login — valid credentials', async () => {
    const { status, data } = await req('POST', '/api/officers/login', {
      badgeId: 'MH-1001', password: 'Officer@123'
    });
    if (status === 200 && data.token) {
      officerToken = data.token;
      return true;
    }
    return false;
  });

  await test('Officer get profile — with token', async () => {
    const { status, data } = await req('GET', '/api/officers/profile', null, officerToken);
    return status === 200 && data.name;
  });

  await test('Officer get stats — returns counts', async () => {
    const { status, data } = await req('GET', '/api/officers/stats', null, officerToken);
    return status === 200 && typeof data.total === 'number';
  });

  await test('Officer get complaints — returns array', async () => {
    const { status, data } = await req('GET', '/api/officers/complaints', null, officerToken);
    return status === 200 && Array.isArray(data);
  });

  await test('Officer route — user token rejected (403)', async () => {
    const { status } = await req('GET', '/api/officers/profile', null, userToken);
    return status === 403;
  });

  // ════════════════════════════════
  //  ADMIN AUTH
  // ════════════════════════════════
  section('Admin Authentication');

  await test('Admin login — wrong credentials returns 401', async () => {
    const { status } = await req('POST', '/api/admin/login', {
      email: 'wrong@admin.com', password: 'wrongpass'
    });
    return status === 401;
  });

  await test('Admin login — valid credentials', async () => {
    const { status, data } = await req('POST', '/api/admin/login', {
      email:    process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    });
    if (status === 200 && data.token) {
      adminToken = data.token;
      return true;
    }
    return false;
  });

  await test('Admin get stats — returns all counts', async () => {
    const { status, data } = await req('GET', '/api/admin/stats', null, adminToken);
    return status === 200 &&
           typeof data.total     === 'number' &&
           typeof data.officers  === 'number' &&
           typeof data.stations  === 'number' &&
           typeof data.users     === 'number';
  });

  await test('Admin get all complaints — returns array', async () => {
    const { status, data } = await req('GET', '/api/admin/complaints', null, adminToken);
    return status === 200 && Array.isArray(data);
  });

  await test('Admin get all officers — returns array', async () => {
    const { status, data } = await req('GET', '/api/admin/officers', null, adminToken);
    return status === 200 && Array.isArray(data);
  });

  await test('Admin get all stations — returns array', async () => {
    const { status, data } = await req('GET', '/api/admin/stations', null, adminToken);
    return status === 200 && Array.isArray(data);
  });

  await test('Admin get all users — returns array', async () => {
    const { status, data } = await req('GET', '/api/admin/users', null, adminToken);
    return status === 200 && Array.isArray(data);
  });

  await test('Admin route — officer token rejected (403)', async () => {
    const { status } = await req('GET', '/api/admin/stats', null, officerToken);
    return status === 403;
  });

  await test('Admin route — user token rejected (403)', async () => {
    const { status } = await req('GET', '/api/admin/stats', null, userToken);
    return status === 403;
  });

  await test('Admin assign complaint — missing fields returns 400', async () => {
    if (!complaintId) return false;
    const { status } = await req('PUT',
      `/api/admin/complaints/${complaintId}/assign`,
      { officerId: 'something' },
      adminToken
    );
    return status === 400;
  });

  // ════════════════════════════════
  //  STATIONS
  // ════════════════════════════════
  section('Station Routes');

  await test('Get stations — public or protected', async () => {
    const { status } = await req('GET', '/api/admin/stations', null, adminToken);
    return status === 200;
  });

  await test('Add station — missing name returns 400', async () => {
    const { status } = await req('POST', '/api/admin/stations',
      { phone: '1234567890' }, adminToken);
    return status === 400;
  });

  await test('Add station — duplicate returns 409', async () => {
    const { status } = await req('POST', '/api/admin/stations',
      { name: 'Pimpri Police Station' }, adminToken);
    return status === 409;
  });

  // ════════════════════════════════
  //  RESULTS
  // ════════════════════════════════
  const total = passed + failed;
  console.log(`\n${bold}\x1b[35m${'═'.repeat(55)}${rst}`);
  console.log(`${bold}${w}  TEST RESULTS${rst}`);
  console.log(`${bold}\x1b[35m${'═'.repeat(55)}${rst}`);
  console.log(`  ${g}Passed :${rst} ${bold}${passed}${rst} / ${total}`);
  console.log(`  ${r}Failed :${rst} ${bold}${failed}${rst} / ${total}`);
  console.log(`  ${c}Score  :${rst} ${bold}${Math.round((passed/total)*100)}%${rst}`);

  if (failed === 0) {
    console.log(`\n${bold}${g}  🎉 All tests passed! CrimeGate API is working correctly.${rst}`);
  } else {
    console.log(`\n${bold}${y}  ⚠️  ${failed} test(s) failed. Check server logs.${rst}`);
  }
  console.log(`${bold}\x1b[35m${'═'.repeat(55)}${rst}\n`);
}

runTests().catch(e => {
  console.error(`\x1b[31m❌ Test runner crashed: ${e.message}\x1b[0m`);
  process.exit(1);
});
