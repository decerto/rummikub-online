import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { initSocket } from './plugins/socket';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(vuetify);

// Initialize socket connection
initSocket();

app.mount('#app');
