#!/usr/bin/env python3
import re

with open('deployment-intake/public/index.html', 'r') as f:
    html = f.read()

# Card 2
html = re.sub(r'(<div class="accordion" id="accordion2">\s*<div class="accordion-header" data-target="accordion2">\s*<span class="accordion-title">💰 Why is a setup deposit required today\?</span>\s*<span class="accordion-chevron">▼</span>\s*</div>\s*<div class="accordion-body" style="max-height: 0; overflow: hidden; transition: max-height 0\.35s ease, padding 0\.35s ease; padding: 0 1rem;">).*?(</div>\s*</div>)',
r'''\1<h4>💰 Why is a setup deposit required today?</h4>
        <p>Great question! When you hit submit, we immediately start building a private workspace just for you — spinning up dedicated AI models, reserving secure cloud space, and locking in engineering time. This isn't a cookie-cutter subscription where you share servers with a hundred other people.</p>
        <p>Your deposit covers that first burst of setup work so we can hit the ground running on Day 1. Think of it like putting down a deposit on a custom suit — except this suit is your own AI-powered automation engine.</p>\2''', html, flags=re.DOTALL)

# Card 3
html = re.sub(r'(<div class="accordion" id="accordion3">\s*<div class="accordion-header" data-target="accordion3">\s*<span class="accordion-title">✅ What is the cost of the Beta Plan\?</span>\s*<span class="accordion-chevron">▼</span>\s*</div>\s*<div class="accordion-body" style="max-height: 0; overflow: hidden; transition: max-height 0\.35s ease, padding 0\.35s ease; padding: 0 1rem;">).*?(</div>\s*</div>)',
r'''\1<h4>✅ What is the cost of the Beta Plan?</h4>
        <p>Right now, you're getting in at our super-low Beta price — a flat rate that's way cheaper than what we'll charge once we launch publicly. And the best part? By joining today, you lock in this low price forever.</p>
        <p>Even if our prices go up later (and they will), you're grandfathered in at the Beta rate for as long as you're an active client. Plus, this includes our Care Plan — automatic security updates, model upgrades, and all the good stuff — at no extra cost.</p>\2''', html, flags=re.DOTALL)

# Card 4
html = re.sub(r'(<div class="accordion" id="accordion4">\s*<div class="accordion-header" data-target="accordion4">\s*<span class="accordion-title">📋 What is the return/refund policy\?</span>\s*<span class="accordion-chevron">▼</span>\s*</div>\s*<div class="accordion-body" style="max-height: 0; overflow: hidden; transition: max-height 0\.35s ease, padding 0\.35s ease; padding: 0 1rem;">).*?(</div>\s*</div>)',
r'''\1<h4>📋 What is the return/refund policy?</h4>
        <p>Since the Beta pricing is already crazy low and we immediately start building infrastructure just for you (servers, AI models, the whole setup), Beta deposits can't be refunded — that stuff gets provisioned the second you hit submit.</p>
        <p>But here's the thing: once our first Founding 5 spots are filled and we open up to the next tier, those clients get our standard refund policy instead. You can find the full legal details in our Terms of Service.</p>
        <p>Bottom line: Founding 5 = non-refundable (but you're getting the best deal ever). Everyone after = standard refund policy applies.</p>\2''', html, flags=re.DOTALL)

# Card 5
html = re.sub(r'(<div sigmaproofー="accordion" id="accordion5">\s*<div class="accordion-header" data-target="accordion5">\s*<span class="accordion-title">💬 How is my data stored and processed\?</span>\s*<span class="accordion-chevron">▼</span>\s*</div>\s*<div class="accordion-body" style="max-height: 0; overflow: hidden; transition: max-height 0\.35s ease, padding 0\.35s ease; padding: 0 1rem;">).*?(</div>\s*</div>)',
r'''\1<h4>🛡️ How is my data stored and processed?</h4>
        <p>Your data never leaves your control. Here's the simple version:</p>
        <ul>
          <li>🔒 Local-first: We try to run everything on your own machine first — your data stays with you.</li>
          <li>☁️ Private cloud fallback: If we need extra power, we use your API keys (not ours). You bring the key, you stay in control.</li>
          <li>🛡️ Encrypted everywhere: AES-256 (military-grade) at rest and TLS 1.3 in transit. Nobody's snooping.</li>
          <li>🚫 No training on your data: Zero-data-retention. We don't keep or train on your stuff. Period.</li>
          <li>, 