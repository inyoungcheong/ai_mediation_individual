# Gender Role Research AI

<p align="center">
  An AI-powered research platform for studying perspectives on gender roles and social attitudes.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#research-methodology"><strong>Research Methodology</strong></a> ·
  <a href="#technical-stack"><strong>Technical Stack</strong></a> ·
  <a href="#deployment"><strong>Deployment</strong></a>
</p>

---

## Overview

This platform facilitates AI-mediated discussions on gender role beliefs for academic research purposes. Participants complete a survey, receive personalized AI-generated summaries of their responses, and engage with an AI conversational agent designed to present alternative perspectives through evidence-based dialogue.

## Features

### 🔬 Research Integration
- **Qualtrics Survey Integration** - Seamless embedded data processing
- **Personalized Response Analysis** - AI-generated summaries of participant beliefs
- **Adaptive Conversation Flow** - Tailored discussions based on individual responses
- **Data Collection Pipeline** - Structured research data capture

### 🤖 AI Capabilities
- **Princeton Azure OpenAI Integration** - Advanced language model capabilities
- **Personalized Challenge Generation** - Context-aware initial messages (800 tokens)
- **Evidence-Based Persuasion** - Research-backed counter-arguments
- **Safety-Filtered Processing** - Robust content moderation

### 💻 Technical Features
- **SvelteKit Framework** - Modern, responsive web application
- **Real-time Chat Interface** - Smooth conversational experience
- **Pattern-Based Fallbacks** - Reliable summary generation
- **Mobile-Responsive Design** - Cross-device compatibility

## Research Methodology

### Participant Flow
1. **Initial Survey** - 6 questions measuring gender role beliefs (1-8 scale)
2. **Response Processing** - AI analysis and summary generation
3. **Personalized Discussion** - Tailored conversational challenges
4. **Data Collection** - Interaction logging for research analysis

### AI Behavior Design
- **Empathetic Acknowledgment** - Validates participant perspectives
- **Evidence-Based Challenges** - Presents research findings and counterexamples
- **Respectful Persuasion** - Maintains dignity while challenging beliefs
- **Structured Argumentation** - Clear, logical presentation of alternative views

## Technical Stack

- **Frontend**: SvelteKit + TypeScript
- **AI Integration**: Princeton Azure OpenAI (GPT-4o-mini)
- **Survey Platform**: Qualtrics with embedded data processing
- **Deployment**: Vercel with GitHub integration
- **Styling**: Tailwind CSS with custom components

## Environment Variables

```bash
OPENAI_API_KEY=your_princeton_azure_openai_key
```

## Development

### Local Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Deployment
Automatically deployed via Vercel GitHub integration. Any push to the main branch triggers a new deployment.

## API Endpoints

- `/api/summarize` - Generates participant response summaries
- `/api/gender_roles` - Handles conversational AI interactions
- `/embed` - Embeddable chatbot interface for Qualtrics

## License

Academic Research Use Only

## Authors

This project is built upon the excellent SvelteKit AI Chatbot template by:
- **Jian Yuan Lee** ([@jyuan](https://twitter.com/jyuan)) - Original SvelteKit AI Chatbot
- **Vercel Labs** - [Next.js AI Chatbot](https://github.com/vercel-labs/ai-chatbot) foundation
- **hauselin** - [SvelteKit adaptation](https://github.com/hauselin/sveltekit-ai-chatbot)

with contributions from:

- **Inyoung Cheong** ([@inyoungcheong](https://inyoungcheong.github.io=))

We extend our gratitude to the open-source community for providing the foundational tools that made this research platform possible.

