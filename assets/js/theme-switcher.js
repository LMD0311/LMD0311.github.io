/**
 * Theme Switcher
 * Allows users to manually toggle between light and dark themes
 * Stores preference in localStorage and overrides system preference
 */

;(function() {
  'use strict';

  // Theme constants
  const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
  };

  const STORAGE_KEY = 'preferred-theme';
  const BODY_CLASS_LIGHT = 'manual-light';
  const BODY_CLASS_DARK = 'manual-dark';

  // Get elements
  let themeSwitcher;
  let themeIcon;

  // State
  let currentTheme = THEMES.AUTO;
  let systemPrefersDark = false;

  /**
   * Initialize the theme switcher
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // Get DOM elements
    themeSwitcher = document.getElementById('theme-switcher');
    themeIcon = themeSwitcher?.querySelector('.theme-icon');

    if (!themeSwitcher || !themeIcon) {
      console.warn('Theme switcher elements not found');
      return;
    }

    // Check system preference
    if (window.matchMedia) {
      const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemPrefersDark = darkMediaQuery.matches;
      
      // Listen for system theme changes
      darkMediaQuery.addEventListener('change', handleSystemThemeChange);
    }

    // Load saved preference
    loadThemePreference();

    // Apply initial theme
    applyTheme();

    // Add event listeners
    themeSwitcher.addEventListener('click', handleThemeToggle);
    themeSwitcher.addEventListener('keydown', handleKeyDown);
  }

  /**
   * Handle system theme changes
   */
  function handleSystemThemeChange(e) {
    systemPrefersDark = e.matches;
    // Only update if user hasn't set a manual preference
    if (currentTheme === THEMES.AUTO) {
      applyTheme();
    }
  }

  /**
   * Handle theme toggle button click
   */
  function handleThemeToggle(e) {
    e.preventDefault();
    toggleTheme();
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTheme();
    }
  }

  /**
   * Toggle between themes
   */
  function toggleTheme() {
    switch (currentTheme) {
      case THEMES.AUTO:
        // If auto and system is dark, switch to light
        // If auto and system is light, switch to dark
        currentTheme = systemPrefersDark ? THEMES.LIGHT : THEMES.DARK;
        break;
      case THEMES.LIGHT:
        currentTheme = THEMES.DARK;
        break;
      case THEMES.DARK:
        currentTheme = THEMES.AUTO;
        break;
    }

    saveThemePreference();
    applyTheme();
  }

  /**
   * Apply the current theme
   */
  function applyTheme() {
    const body = document.body;
    
    // Remove existing theme classes
    body.classList.remove(BODY_CLASS_LIGHT, BODY_CLASS_DARK);

    // Determine effective theme
    let effectiveTheme;
    if (currentTheme === THEMES.AUTO) {
      effectiveTheme = systemPrefersDark ? THEMES.DARK : THEMES.LIGHT;
    } else {
      effectiveTheme = currentTheme;
    }

    // Apply theme class
    if (effectiveTheme === THEMES.DARK) {
      body.classList.add(BODY_CLASS_DARK);
    } else {
      body.classList.add(BODY_CLASS_LIGHT);
    }

    // Update icon and tooltip
    updateThemeIcon(effectiveTheme);
    updateThemeTooltip();
  }

  /**
   * Update the theme icon
   */
  function updateThemeIcon(effectiveTheme) {
    if (!themeIcon) return;

    // Remove existing icon classes
    themeIcon.classList.remove('fa-moon', 'fa-sun', 'fa-adjust');

    // Add appropriate icon
    if (currentTheme === THEMES.AUTO) {
      themeIcon.classList.add('fa-adjust');
    } else if (effectiveTheme === THEMES.DARK) {
      themeIcon.classList.add('fa-sun');
    } else {
      themeIcon.classList.add('fa-moon');
    }
  }

  /**
   * Update the theme tooltip
   */
  function updateThemeTooltip() {
    if (!themeSwitcher) return;

    let tooltip;
    switch (currentTheme) {
      case THEMES.AUTO:
        tooltip = 'Switch to light mode';
        break;
      case THEMES.LIGHT:
        tooltip = 'Switch to dark mode';
        break;
      case THEMES.DARK:
        tooltip = 'Switch to auto mode';
        break;
    }

    themeSwitcher.setAttribute('title', tooltip);
    themeSwitcher.setAttribute('aria-label', tooltip);
  }

  /**
   * Load theme preference from localStorage
   */
  function loadThemePreference() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && Object.values(THEMES).includes(saved)) {
        currentTheme = saved;
      }
    } catch (e) {
      console.warn('Could not load theme preference:', e);
    }
  }

  /**
   * Save theme preference to localStorage
   */
  function saveThemePreference() {
    try {
      localStorage.setItem(STORAGE_KEY, currentTheme);
    } catch (e) {
      console.warn('Could not save theme preference:', e);
    }
  }

  /**
   * Get current theme for external use
   */
  function getCurrentTheme() {
    return {
      current: currentTheme,
      effective: currentTheme === THEMES.AUTO ? 
        (systemPrefersDark ? THEMES.DARK : THEMES.LIGHT) : 
        currentTheme
    };
  }

  // Initialize when script loads
  init();

  // Export for external use
  window.ThemeSwitcher = {
    getCurrentTheme: getCurrentTheme,
    toggleTheme: toggleTheme,
    THEMES: THEMES
  };

})();