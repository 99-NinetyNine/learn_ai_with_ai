// services/geminiService.js
export class GeminiService {
    constructor(apiKey) {
      this.apiKey = apiKey;
      this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
    }
  
    async generateContent(prompt, context = '', options = {}) {
      try {
        const requestBody = {
          contents: [{
            parts: [{
              text: this.buildPrompt(prompt, context)
            }]
          }],
          generationConfig: {
            temperature: options.temperature || 0.7,
            topK: options.topK || 40,
            topP: options.topP || 0.95,
            maxOutputTokens: options.maxOutputTokens || 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        };
  
        const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          return data.candidates[0].content.parts[0].text;
        } else {
          throw new Error('No content generated');
        }
      } catch (error) {
        console.error('Gemini API Error:', error);
        throw new Error(`Failed to generate content: ${error.message}`);
      }
    }
  
    buildPrompt(userRequest, context) {
      return `
  Context: You are an AI assistant helping users understand PDF research papers and academic documents. You should provide clear, accurate, and helpful responses.
  
  Document Context:
  ${context}
  
  User Request: ${userRequest}
  
  Please provide a helpful response that directly addresses the user's request. Be concise but thorough.
      `.trim();
    }
  
    // Specialized methods for different AI features
    async simplifyText(selectedText, documentContext = '') {
      const prompt = `
  Please simplify and explain the following text in easy-to-understand language:
  
  "${selectedText}"
  
  Make it accessible to someone who might not be familiar with technical jargon or complex academic language. Provide analogies or examples if helpful.
      `;
      
      return this.generateContent(prompt, documentContext);
    }
  
    async explainTerminology(selectedText, documentContext = '') {
      const prompt = `
  Identify and explain any technical terms, jargon, acronyms, or complex concepts in the following text:
  
  "${selectedText}"
  
  For each term identified, provide:
  1. A clear definition
  2. Context of how it's used in this field
  3. Any relevant background information
  
  Format as a list with term followed by explanation.
      `;
      
      return this.generateContent(prompt, documentContext);
    }
  
    async generateSummary(documentContext) {
      const prompt = `
  Please generate a comprehensive summary of this document. Include:
  
  1. Main topic and purpose
  2. Key arguments or findings
  3. Important conclusions
  4. Methodology (if applicable)
  5. Significance of the work
  
  Structure the summary in clear sections and bullet points where appropriate.
      `;
      
      return this.generateContent(prompt, documentContext, { maxOutputTokens: 3000 });
    }
  
    async findConnections(documentContext, selectedText = '') {
      const prompt = `
  Analyze the relationships and connections between different concepts, sections, and ideas in this document${selectedText ? ` with particular focus on: "${selectedText}"` : ''}.
  
  Identify:
  1. How different sections relate to each other
  2. Recurring themes or concepts
  3. Cause-and-effect relationships
  4. Supporting evidence and main arguments
  5. Contradictions or tensions (if any)
  
  Present the connections in a clear, organized manner.
      `;
      
      return this.generateContent(prompt, documentContext);
    }
  
    async extractKeyPoints(documentContext) {
      const prompt = `
  Extract and list the most important key points, insights, and takeaways from this document.
  
  Organize them into categories such as:
  1. Main findings/results
  2. Key concepts
  3. Practical implications
  4. Limitations or caveats
  5. Future directions
  
  Present as numbered or bulleted lists for easy scanning.
      `;
      
      return this.generateContent(prompt, documentContext);
    }
  
    async generateQuestions(documentContext, selectedText = '') {
      const prompt = `
  Generate thoughtful study questions based on this document${selectedText ? ` with emphasis on: "${selectedText}"` : ''}.
  
  Create questions at different levels:
  
  Comprehension Questions (3-4):
  - Test basic understanding of key concepts
  
  Analysis Questions (3-4):  
  - Require deeper thinking about relationships and implications
  
  Critical Thinking Questions (2-3):
  - Encourage evaluation and synthesis
  
  Format each question clearly and provide brief hints if the question is particularly challenging.
      `;
      
      return this.generateContent(prompt, documentContext);
    }
  
    async analyzeDiagram(documentContext, diagramDescription = '') {
      const prompt = `
  Based on the document context${diagramDescription ? ` and this diagram description: "${diagramDescription}"` : ''}, provide analysis of any visual elements, diagrams, charts, or figures.
  
  For each visual element, explain:
  1. What it represents
  2. Key components and their relationships
  3. How it supports the document's main points
  4. What insights can be gained from it
  5. How to interpret any data or trends shown
  
  If no specific diagram is described, analyze what types of visual aids would be helpful for this content.
      `;
      
      return this.generateContent(prompt, documentContext);
    }
  
    async provideFeedback(documentContext, readingProgress, toolUsage) {
      const prompt = `
  Based on the user's reading progress and tool usage patterns, provide personalized feedback and suggestions.
  
  Reading Progress: ${readingProgress}%
  Tools Used: ${JSON.stringify(toolUsage)}
  
  Provide:
  1. Assessment of comprehension level
  2. Suggestions for better understanding
  3. Recommended tools or strategies
  4. Areas that might need more attention
  
  Keep suggestions practical and encouraging.
      `;
      
      return this.generateContent(prompt, documentContext);
    }
  }
  
export default GeminiService;