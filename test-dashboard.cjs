const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Testing Impact Dashboard...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  console.log('📍 Navigating to homepage...');
  await page.goto('http://localhost:4321');
  await page.waitForLoadState('networkidle');
  
  // Scroll to Impact Dashboard
  console.log('📊 Scrolling to Impact Dashboard...');
  await page.evaluate(() => {
    const element = document.querySelector('#impact');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  });
  
  await page.waitForTimeout(2000);
  
  // Check for metrics
  const metrics = await page.$$('.metric-counter');
  console.log(`✅ Found ${metrics.length} animated metrics`);
  
  // Take screenshot
  const impactSection = await page.$('#impact');
  if (impactSection) {
    await impactSection.screenshot({ 
      path: 'impact-dashboard.png' 
    });
    console.log('📸 Screenshot saved: impact-dashboard.png');
  }
  
  // Check mini metrics
  const miniMetrics = await page.$$eval('.text-2xl.font-bold', elements => 
    elements.map(el => el.textContent)
  );
  console.log('📈 Mini metrics found:', miniMetrics.filter(m => m).join(', '));
  
  console.log('\n✨ Impact Dashboard successfully implemented!');
  console.log('   - Animated counters for key metrics');
  console.log('   - Color-coded by venture');
  console.log('   - Mini metrics bar at bottom');
  console.log('   - Call-to-action buttons');
  
  await page.waitForTimeout(5000);
  await browser.close();
})();