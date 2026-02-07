const { getAccessToken, TOKEN_PATH } = require('./token-store');

const OC_API_URL = 'https://api.opencollective.com/graphql/v2';

const MEMBERS_QUERY = `
  query ($slug: String!, $limit: Int!, $offset: Int!) {
    account(slug: $slug) {
      members(role: BACKER, limit: $limit, offset: $offset) {
        totalCount
        nodes {
          account {
            name
            slug
            emails
          }
          totalDonations {
            value
            currency
          }
          createdAt
        }
      }
    }
  }
`;

const TRANSACTIONS_QUERY = `
  query ($slug: String!, $limit: Int!, $offset: Int!) {
    account(slug: $slug) {
      transactions(type: CREDIT, limit: $limit, offset: $offset) {
        totalCount
        nodes {
          fromAccount {
            name
            slug
            emails
          }
          amount {
            value
            currency
          }
          createdAt
        }
      }
    }
  }
`;

async function queryOC(query, variables) {
  const token = getAccessToken();
  if (!token) {
    throw new Error(
      `No OpenCollective OAuth token found. Run "npm run setup-oauth" first. Expected token at: ${TOKEN_PATH}`
    );
  }

  const response = await fetch(OC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      'OpenCollective OAuth token is invalid or expired. Run "npm run setup-oauth" to re-authenticate.'
    );
  }

  if (!response.ok) {
    throw new Error(`OpenCollective API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`OpenCollective GraphQL error: ${json.errors[0].message}`);
  }

  return json.data;
}

async function checkDonorByMembers(email) {
  const slug = process.env.OC_COLLECTIVE_SLUG;
  const limit = 100;
  let offset = 0;
  let totalCount = Infinity;

  while (offset < totalCount) {
    const data = await queryOC(MEMBERS_QUERY, { slug, limit, offset });
    const members = data.account.members;
    totalCount = members.totalCount;

    for (const member of members.nodes) {
      const emails = member.account.emails || [];
      if (emails.some((e) => e.toLowerCase() === email.toLowerCase())) {
        return {
          found: true,
          name: member.account.name,
          totalDonations: member.totalDonations,
        };
      }
    }

    offset += limit;
  }

  return { found: false };
}

async function checkDonorByTransactions(email) {
  const slug = process.env.OC_COLLECTIVE_SLUG;
  const limit = 100;
  let offset = 0;
  let totalCount = Infinity;

  while (offset < totalCount) {
    const data = await queryOC(TRANSACTIONS_QUERY, { slug, limit, offset });
    const transactions = data.account.transactions;
    totalCount = transactions.totalCount;

    for (const tx of transactions.nodes) {
      if (!tx.fromAccount) continue;
      const emails = tx.fromAccount.emails || [];
      if (emails.some((e) => e.toLowerCase() === email.toLowerCase())) {
        return {
          found: true,
          name: tx.fromAccount.name,
        };
      }
    }

    offset += limit;
  }

  return { found: false };
}

async function verifyDonor(email) {
  try {
    const result = await checkDonorByMembers(email);
    if (result.found) return result;
  } catch (err) {
    console.warn('Members query failed, falling back to transactions:', err.message);
  }

  try {
    return await checkDonorByTransactions(email);
  } catch (err) {
    console.error('Transactions query also failed:', err.message);
    throw new Error('Unable to verify donation status. Please try again later.');
  }
}

module.exports = { verifyDonor };
