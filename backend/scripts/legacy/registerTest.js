const register = async () => {
  try {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testadmin2@example.com',
        password: 'Admin123!',
        full_name: 'Test Admin 2',
        role: 'admin',
      }),
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log(text);
  } catch (err) {
    console.error(err);
  }
};

register();
