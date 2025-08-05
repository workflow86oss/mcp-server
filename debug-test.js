const { execSync } = require('child_process');
const path = require('path');

console.log('Environment variables:');
console.log('W86_API_KEY:', process.env.W86_API_KEY ? 'SET' : 'NOT SET');
console.log('W86_DOMAIN:', process.env.W86_DOMAIN || 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

const execPath = path.join(__dirname, 'exec.sh');
const argsJson = JSON.stringify({"status":"ALL","pageNumber":0});

try {
  const env = { ...process.env, W86_WITH: 'node' };
  
  console.log('\nCalling exec.sh with env:', { 
    W86_API_KEY: env.W86_API_KEY ? 'SET' : 'NOT SET',
    W86_DOMAIN: env.W86_DOMAIN || 'NOT SET',
    W86_WITH: env.W86_WITH 
  });
  
  const result = execSync(`"${execPath}" "list-workflows" '${argsJson}'`, {
    encoding: 'utf8',
    env,
    timeout: 30000,
  });
  
  console.log('\nRaw result:');
  console.log(result);
  
  // Parse the JSON response from the MCP server
  const lines = result.split('\n').filter(line => line.trim());
  
  // Find the JSON response (skip the debug output)
  let jsonResponse = '';
  for (const line of lines) {
    if (line.startsWith('{') && (line.includes('"result"') || line.includes('"error"'))) {
      jsonResponse = line;
      break;
    }
  }
  
  console.log('\nParsed JSON response:');
  if (jsonResponse) {
    const parsed = JSON.parse(jsonResponse);
    console.log('Success:', !!parsed.result);
    console.log('Error:', !!parsed.error);
    if (parsed.error) {
      console.log('Error details:', parsed.error);
    }
    if (parsed.result && parsed.result.content) {
      console.log('Content length:', parsed.result.content.length);
      console.log('First few chars:', parsed.result.content[0]?.text?.substring(0, 100));
    }
  } else {
    console.log('No JSON response found');
  }
  
} catch (error) {
  console.error('Error:', error.message);
  if (error.stderr) {
    console.error('Stderr:', error.stderr.toString());
  }
  if (error.stdout) {
    console.error('Stdout:', error.stdout.toString());
  }
}