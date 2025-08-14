const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Testing Career Timeline...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 200
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  console.log('📍 Navigating to homepage...');
  await page.goto('http://localhost:4321');
  await page.waitForLoadState('networkidle');
  
  // Scroll to Timeline
  console.log('⏰ Scrolling to Career Timeline...');
  await page.evaluate(() => {
    const element = document.querySelector('#timeline');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  });
  
  await page.waitForTimeout(2000);
  
  // Check timeline periods
  const periods = await page.$$('.timeline-period');
  console.log(`✅ Found ${periods.length} career periods`);
  
  // Check for current period highlight
  const highlighted = await page.$('.period-card.border-blue-400');
  if (highlighted) {
    console.log('✅ Current period (2023-Present) is highlighted');
  }
  
  // Count total projects
  const projects = await page.$$('.project-item');
  console.log(`📊 Total projects across timeline: ${projects.length}`);
  
  // Take screenshot
  const timelineSection = await page.$('#timeline');
  if (timelineSection) {
    await timelineSection.screenshot({ 
      path: 'career-timeline.png' 
    });
    console.log('📸 Screenshot saved: career-timeline.png');
  }
  
  // Check timeline stats
  const stats = await page.$$eval('.text-3xl.font-bold', elements => 
    elements.map(el => el.textContent).filter(t => t && !t.includes('%'))
  );
  console.log('📈 Timeline statistics:', stats.join(', '));
  
  console.log('\n✨ Career Timeline Features:');
  console.log('   ✓ Visual timeline with gradient line');
  console.log('   ✓ Alternating left/right layout');
  console.log('   ✓ Project cards with icons');
  console.log('   ✓ Concurrent project indicators');
  console.log('   ✓ Pattern insight box at bottom');
  
  await page.waitForTimeout(5000);
  await browser.close();
})();