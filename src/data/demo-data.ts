export const queryPerformance = [
  { category: "Late-Night Food", tested: 18, visibility: 89, accuracy: 94, position: "1.8" },
  { category: "Budget Meals", tested: 15, visibility: 64, accuracy: 87, position: "2.6" },
  { category: "General Category", tested: 24, visibility: 71, accuracy: 91, position: "2.2" },
  { category: "College Student", tested: 17, visibility: 88, accuracy: 96, position: "1.9" },
  { category: "Product / Service Specific", tested: 12, visibility: 58, accuracy: 83, position: "3.1" },
];
export const benchmarkQueries = [
  { query: "Best late-night food near campus", category: "Late-Night Food", audience: "College students", intent: "Discovery", location: "Austin, TX", tested: "2 hours ago", mentioned: true, position: "#1" },
  { query: "Affordable dinner options open after 10", category: "Budget Meals", audience: "Budget focused", intent: "Comparison", location: "Austin, TX", tested: "2 hours ago", mentioned: true, position: "#3" },
  { query: "Where can I get a surf and turf burrito?", category: "Product Specific", audience: "Local diners", intent: "Purchase", location: "Austin, TX", tested: "Yesterday", mentioned: true, position: "#2" },
  { query: "Quick casual food with vegetarian options", category: "General Category", audience: "Diet conscious", intent: "Discovery", location: "Austin, TX", tested: "Yesterday", mentioned: false, position: "—" },
  { query: "Good group dinner near the university", category: "College Student", audience: "Student groups", intent: "Discovery", location: "Austin, TX", tested: "2 days ago", mentioned: true, position: "#2" },
];
export const issues = [
  { title: "Incorrect closing time", severity: "High", truth: "11:00 PM", ai: "9:00 PM", queries: 7, source: "old_menu.pdf", classification: "Source Fragmentation", confidence: "High", status: "Open" },
  { title: "Outdated signature item price", severity: "Medium", truth: "$14.99", ai: "$12.99", queries: 3, source: "Third-party directory", classification: "Outdated Source", confidence: "Medium", status: "Investigating" },
  { title: "Unverified delivery radius", severity: "Low", truth: "5 miles", ai: "10 miles", queries: 2, source: "Unknown", classification: "Needs Review", confidence: "Low", status: "Open" },
];
export const truthSections = [
  { title: "Business Identity", icon: "building" as const, facts: [["Business name", "Demo Business"], ["Category", "Fast casual restaurant"], ["Primary location", "Austin, Texas"]] },
  { title: "Hours", icon: "clock" as const, facts: [["Monday–Thursday", "11:00 AM–11:00 PM"], ["Friday–Saturday", "11:00 AM–12:00 AM"], ["Sunday", "11:00 AM–10:00 PM"]] },
  { title: "Products & Services", icon: "box" as const, facts: [["Surf & Turf Burrito", "$14.99"], ["Vegetarian options", "Available"], ["Online ordering", "Available"]] },
  { title: "Policies & Important Facts", icon: "shield" as const, facts: [["Delivery radius", "5 miles"], ["Group orders", "24-hour notice"], ["Late-night service", "Available Friday–Saturday"]] },
];
