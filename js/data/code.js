/* TypeLab code practice: one-line snippets written for this project, grouped by language.
   Plain ASCII only, one line each, so every character can be shown on the virtual keyboard.
   They are chosen to use the symbols programmers type all day: brackets, quotes, operators,
   underscores, slashes, pipes, and so on. */
(function (root) {
  "use strict";

  const byLang = {
    javascript: [
      "const total = items.reduce((a, b) => a + b.price, 0);",
      "if (user && user.isAdmin) { showPanel(); }",
      "for (let i = 0; i < arr.length; i++) { sum += arr[i]; }",
      "const { id, name } = await fetch(`/api/users/${id}`).then((r) => r.json());",
      "document.querySelector(\"#btn\").addEventListener(\"click\", () => run());",
      "const isEven = (n) => n % 2 === 0;",
      "let name = user?.profile?.name ?? \"guest\";",
      "console.log(`Total: ${total.toFixed(2)}`);",
      "setTimeout(() => { done = true; }, 1000);",
      "const unique = [...new Set(list)].sort((a, b) => a - b);",
      "try { JSON.parse(text); } catch (err) { console.error(err.message); }",
      "module.exports = { add, subtract, multiply };",
      "while (queue.length > 0) { process(queue.shift()); }",
      "const flags = (a & b) | (c ^ d);",
      "Object.keys(obj).forEach((key) => delete obj[key]);",
    ],
    python: [
      "def add(a, b): return a + b",
      "for i in range(10): print(f\"Item {i}: {items[i]}\")",
      "with open(\"data.txt\", \"r\") as f: lines = f.read().split(\"\\n\")",
      "squares = [x ** 2 for x in range(1, 11) if x % 2 == 0]",
      "if __name__ == \"__main__\": main()",
      "import numpy as np",
      "result = {k: v for k, v in pairs.items() if v is not None}",
      "def __init__(self, name): self.name = name",
      "while True: line = input(\"> \").strip()",
      "total = sum(len(word) for word in text.split())",
      "print(\"Hello, world!\")",
      "double = lambda x: x * 2 + 1",
      "raise ValueError(\"Invalid value: \" + str(x))",
      "@app.route(\"/users/<int:id>\") def user(id): return get(id)",
      "count = 5 # number of retries",
    ],
    html: [
      "<div class=\"card\"><h2 id=\"title\">Hello</h2></div>",
      "<a href=\"https://example.com/page?id=7&tab=2\">Read more</a>",
      "<input type=\"email\" name=\"user_email\" placeholder=\"you@mail.com\" required>",
      "<ul><li>One</li><li>Two</li><li>Three</li></ul>",
      "<img src=\"logo.png\" alt=\"Logo\" width=\"64\" height=\"64\">",
      "<button onclick=\"save()\" class=\"btn btn-primary\">Save</button>",
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<link rel=\"stylesheet\" href=\"css/style.css\">",
      "<!-- main section starts here -->",
      "<script src=\"js/app.js\" defer></script>",
    ],
    css: [
      ".card { margin: 0 auto; padding: 16px 24px; border-radius: 8px; }",
      "a:hover, a:focus { color: #4f46e5; text-decoration: underline; }",
      "body { font: 16px/1.5 system-ui, sans-serif; background: #f7f8fc; }",
      ".grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }",
      "@media (max-width: 600px) { .nav { display: none; } }",
      ":root { --accent: #4f46e5; --radius: 12px; }",
      ".btn::after { content: \">\"; opacity: 0.6; transition: all 0.2s ease; }",
      "h1 { font-size: clamp(1.5rem, 4vw, 2.5rem); margin: 0 0 8px; }",
    ],
    sql: [
      "SELECT name, email FROM users WHERE age >= 18 AND city = 'Delhi';",
      "INSERT INTO orders (id, user_id, total) VALUES (101, 7, 49.99);",
      "UPDATE products SET stock = stock - 1 WHERE id = 42;",
      "SELECT COUNT(*) AS total FROM orders GROUP BY status HAVING COUNT(*) > 5;",
      "DELETE FROM sessions WHERE expires_at < NOW();",
      "SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id;",
      "CREATE TABLE notes (id INT PRIMARY KEY, body TEXT NOT NULL);",
      "SELECT * FROM logs ORDER BY created_at DESC LIMIT 10;",
    ],
    shell: [
      "git commit -m \"Fix login bug\" && git push origin main",
      "ls -la ~/projects | grep \".js\" | wc -l",
      "cd /var/www/html && sudo chmod -R 755 ./assets",
      "for f in *.txt; do echo \"$f\"; done",
      "export PATH=\"$HOME/bin:$PATH\"",
      "curl -s https://api.example.com/v1/items | jq '.[0].name'",
      "npm install --save-dev eslint prettier",
      "docker run -d -p 8080:80 --name web nginx",
      "python3 -m venv .venv && source .venv/bin/activate",
      "grep -rn \"TODO\" src/ > todo.txt",
    ],
  };

  const all = Object.values(byLang).flat();
  const api = { byLang, all };
  if (typeof module === "object" && module.exports) module.exports = api;
  else ((root.TL = root.TL || {}).data = root.TL.data || {}).code = api;
})(typeof window !== "undefined" ? window : globalThis);
