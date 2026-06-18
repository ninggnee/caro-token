const login = async () => {
  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testadmin2@example.com',
        password: 'Admin123!'
      }),
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
};

login();
