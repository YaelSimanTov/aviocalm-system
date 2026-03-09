const http = require('http');

const testAdminLogin = () => {
  const postData = JSON.stringify({
    username: 'admin',
    password: 'Admin123!'
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        console.log('Admin login response:', {
          success: parsed.success,
          username: parsed.data?.user?.username,
          role: parsed.data?.user?.role,
          is_first_login: parsed.data?.user?.is_first_login
        });
      } catch (e) {
        console.log('Response is not valid JSON:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(postData);
  req.end();
};

testAdminLogin();
