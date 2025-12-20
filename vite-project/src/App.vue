<script setup>
// Root layout: the pages are rendered via router-view.
</script>

<template>
  <div id="app-root" class="root-layout">
    <aside class="sidebar">
      <div class="brand">ศูนย์บริการ</div>
      <nav class="nav">
        <router-link to="/submit" class="nav-item" active-class="active" exact
          >ส่งแบบฟอร์ม</router-link
        >
        <router-link to="/form-view" class="nav-item" active-class="active"
          >ดูแบบฟอร์ม</router-link
        >
        <router-link to="/settings" class="nav-item" active-class="active"
          >การตั้งค่า</router-link
        >
      </nav>
    </aside>

    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<style>
  body {
    margin: 0
  }
</style>

<style scoped>
.root-layout {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(180deg, #eef5fb, #f9fbff);
}
.sidebar {
  width: 220px;
  background: #0b63b8;
  color: #fff;
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.brand {
  font-weight: 800;
  margin-bottom: 18px;
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nav-item {
  color: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 8px;
  text-decoration: none;
}
.nav-item.active {
  background: rgba(255, 255, 255, 0.08);
}
.content {
  flex: 1;
  padding: 28px;
}

@media (max-width: 900px) {
  .root-layout {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    flex-direction: row;
    gap: 12px;
    align-items: center;
  }
  .nav {
    flex-direction: row;
  }
}
</style>
