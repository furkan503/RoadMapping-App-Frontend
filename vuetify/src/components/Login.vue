<template>
    <v-container class="login-container" justify="center" align="center">
      <v-card max-width="400" class="mx-auto my-12 pa-4">
        <v-card-title class="headline">Login</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="login">
            <v-text-field
              label="Username"
              v-model="username"
              required
              outlined
            ></v-text-field>
            <v-text-field
              label="Password"
              v-model="password"
              type="password"
              required
              outlined
            ></v-text-field>
            <v-btn type="submit" color="primary" block>Login</v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-container>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  
  const username = ref('');
  const password = ref('');
  const router = useRouter();
  
  const login = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/login/custom_login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.value,
          password: password.value
        })
      });
  
      console.log('HTTP status:', response.status);
  
      if (response.ok) {
        const data = await response.json();
        if (data.access != undefined) {
          localStorage.setItem('accessToken', data.access); 
          localStorage.setItem('refreshToken', data.refresh);
          router.push('/map'); 
          console.log('Login response:', data.message);
        }
      } else {
        console.log('Login failed');
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('An error occurred while logging in.');
    }
  };
  </script>
  
  <style scoped>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f7f7f7;
  }
  
  .v-card {
    width: 100%;
    max-width: 400px;
  }
  
  .v-btn {
    margin-top: 20px;
  }
  </style>
  