const bcrypt = require('bcryptjs');
const db = require('./db');

async function seedDatabase() {
  console.log('[Seeder] Seeding initial sample data for demonstration...');

  try {
    // Check if posts already exist
    const [existingPosts] = await db.execute('SELECT COUNT(*) as count FROM posts');
    if (existingPosts[0].count > 0) {
      console.log(`[Seeder] Database already contains ${existingPosts[0].count} posts. Skipping sample seeding.`);
      return;
    }

    // Create demo users
    const passwordHash = await bcrypt.hash('password123', 10);

    const [user1Res] = await db.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
      ['Elena Rostova', 'elena@example.com', passwordHash]
    );
    const user1Id = user1Res.insertId;

    const [user2Res] = await db.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
      ['David Chen', 'david@example.com', passwordHash]
    );
    const user2Id = user2Res.insertId;

    // Sample posts
    const samplePosts = [
      {
        user_id: user1Id,
        title: 'Building Resilient Web Architectures with Vanilla JavaScript',
        category: 'Technology',
        content: `In an era dominated by sprawling JavaScript frameworks and rapid release churn, there is a refreshing clarity and power in returning to native web primitives.

HTML5, modern CSS, and ES6+ vanilla JavaScript now provide native solutions for almost every feature that previously demanded an external framework:
1. Native <dialog> elements with seamless focus traps and overscroll containment.
2. Web components and custom elements for encapsulated UI modules.
3. CSS container queries, subgrid, and modern color spaces.
4. Native Fetch API with streams and abort controllers.

By embracing the platform, you produce smaller bundles, faster First Contentful Paint (FCP), and maintain code that will still run effortlessly ten years from today.`
      },
      {
        user_id: user2Id,
        title: 'The Art of Visual Hierarchy: Designing for Reader Engagement',
        category: 'Design',
        content: `Great typography does not shout; it gently guides the reader's eyes through an intentional narrative journey.

When designing long-form reading platforms, consider the golden trifecta of typographic comfort:
- Measure: 45 to 75 characters per line keeps the eye from fatiguing.
- Leading: A line-height between 1.6 and 1.8 gives breathing room between sentences.
- Contrast: Deep slate on warm off-white creates high legibility without the harsh glare of pure black on pure white.

Pairing modern sans-serif headings with high-readability serif body text grounds technical articles in editorial elegance.`
      },
      {
        user_id: user1Id,
        title: 'Micro-Habits for Sustainable Creative Output',
        category: 'Lifestyle',
        content: `We frequently hear advice to dedicate four unbroken hours of deep focus each day to our creative projects. For many busy developers and writers, however, that expectation leads only to friction and discouragement.

Instead, the compound power of micro-habits changes everything:
- Write 150 words before checking your morning email.
- Sketch one wireframe or UI pattern every afternoon.
- Review one new CSS or JavaScript specification each evening.

These atomic actions remove the intimidation factor and create consistent momentum that compounds over months.`
      },
      {
        user_id: user2Id,
        title: 'Demystifying Database Indexing: B-Trees and Query Optimization',
        category: 'Technology',
        content: `As application data grows from hundreds of rows to millions, database queries that once took milliseconds can slow down entire servers. Understanding how indexes work is one of the most critical skills a software engineer can master.

Key takeaways for relational databases like MySQL:
1. Primary key indexes are clustered, arranging physical records sequentially on disk.
2. Secondary indexes map indexed columns back to the primary key.
3. Compound indexes follow the Leftmost Prefix rule — order matters!
4. Avoid functions on indexed columns in your WHERE clause, as they prevent index lookups (sargability).

Always run EXPLAIN on your heavy queries to confirm whether MySQL is using an index range scan rather than a full table scan.`
      }
    ];

    for (const post of samplePosts) {
      const [pRes] = await db.execute(
        'INSERT INTO posts (user_id, title, content, category, image_url) VALUES (?, ?, ?, ?, NULL)',
        [post.user_id, post.title, post.content, post.category]
      );

      // Add a couple of initial comments
      await db.execute(
        'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
        [pRes.insertId, post.user_id === user1Id ? user2Id : user1Id, 'Incredible read! The points on native web primitives resonate so strongly with what our team is experiencing.']
      );
    }

    console.log('[Seeder] Sample posts and comments successfully seeded!');
  } catch (err) {
    console.error('[Seeder Error]', err.message);
  }
}

// Run seeder if executed directly
if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

module.exports = seedDatabase;
