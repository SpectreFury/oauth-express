import "./App.css";

function App() {
  const handleLogin = async () => {
    window.location.href = "http://localhost:3000/auth/google?redirectURL=http://localhost:5173";
  };

  return (
    <main>
      <h1>Google Oauth</h1>
      <button onClick={handleLogin}>Login with Google</button>
    </main>
  );
}

export default App;
