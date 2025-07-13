import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  Search, 
  NavigateBefore, 
  NavigateNext, 
  ZoomIn, 
  ZoomOut, 
  Highlight,
  Psychology,
  FindInPage,
  Lightbulb,
  Quiz,
  AccountTree,
  AutoAwesome,
  Visibility,
  VisibilityOff,
  DarkMode,
  LightMode
} from '@mui/icons-material';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Gemini AI Service
class GeminiService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
  }

  async callGemini(prompt, context = '') {
    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${context}\n\nUser Request: ${prompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
    } catch (error) {
      console.error('Gemini API Error:', error);
      return 'Error connecting to AI service. Please check your API key.';
    }
  }
}

// Main PDF Reader Component
const AIPDFReader = () => {
  // PDF States
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedText, setSelectedText] = useState('');
  
  // UI States
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlights, setHighlights] = useState([]);
  
  // AI States
  const [aiResponses, setAiResponses] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  
  // Refs
  const fileInputRef = useRef(null);
  const geminiService = useRef(new GeminiService('your-api-key-here')); // Replace with actual API key

  // PDF Event Handlers
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  };

  const onFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
    }
  };

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= numPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handleZoom = (delta) => {
    setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  // Text Selection Handler
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selected = selection.toString().trim();
    if (selected && selected.length > 0) {
      setSelectedText(selected);
      addAIResponse('📝 Text Selected', `Selected: "${selected.substring(0, 100)}${selected.length > 100 ? '...' : ''}"`);
    }
  };

  // AI Functions
  const addAIResponse = (title, content, type = 'info') => {
    const newResponse = {
      id: Date.now(),
      title,
      content,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setAiResponses(prev => [newResponse, ...prev.slice(0, 4)]); // Keep only 5 responses
  };

  const callAI = async (prompt, context = '') => {
    setIsProcessing(true);
    try {
      const fullContext = `PDF Context: ${extractedText}\nSelected Text: ${selectedText}\n${context}`;
      const response = await geminiService.current.callGemini(prompt, fullContext);
      return response;
    } catch (error) {
      console.error('AI call failed:', error);
      return 'Failed to get AI response. Please try again.';
    } finally {
      setIsProcessing(false);
    }
  };

  // AI Tool Functions
  const simplifyText = async () => {
    if (!selectedText) {
      addAIResponse('⚠️ No Selection', 'Please select some text first.');
      return;
    }
    
    const response = await callAI(
      'Simplify and explain this text in simple terms. Make it easy to understand for someone not familiar with the topic.',
      `Text to simplify: ${selectedText}`
    );
    addAIResponse('🔍 Simplified Explanation', response, 'simplify');
  };

  const explainTerminology = async () => {
    if (!selectedText) {
      addAIResponse('⚠️ No Selection', 'Please select some text first.');
      return;
    }
    
    const response = await callAI(
      'Identify and explain any technical terms, jargon, or complex concepts in this text. Provide clear definitions.',
      `Text to analyze: ${selectedText}`
    );
    addAIResponse('📚 Terminology Explained', response, 'terminology');
  };

  const generateSummary = async () => {
    const response = await callAI(
      'Generate a comprehensive summary of this document. Include key points, main arguments, and important conclusions.',
      `Full document context for summary`
    );
    addAIResponse('📋 Document Summary', response, 'summary');
  };

  const findConnections = async () => {
    const response = await callAI(
      'Analyze the relationships and connections between different sections and concepts in this document. Show how ideas connect to each other.',
      `Document context for connection analysis`
    );
    addAIResponse('🔗 Content Connections', response, 'connections');
  };

  const extractKeyPoints = async () => {
    const response = await callAI(
      'Extract the most important key points, insights, and takeaways from this document. Present them in a clear, organized way.',
      `Document context for key point extraction`
    );
    addAIResponse('💡 Key Insights', response, 'keypoints');
  };

  const generateQuestions = async () => {
    const response = await callAI(
      'Generate thoughtful study questions based on this document. Include comprehension, analysis, and critical thinking questions.',
      `Document context for question generation`
    );
    addAIResponse('❓ Study Questions', response, 'questions');
  };

  const analyzeDiagram = async () => {
    const response = await callAI(
      'If there are any diagrams, charts, or visual elements visible in the current context, analyze and explain them in detail.',
      `Current page context for diagram analysis`
    );
    addAIResponse('📊 Diagram Analysis', response, 'diagram');
  };

  // Highlight Functions
  const toggleHighlight = () => {
    setHighlightMode(!highlightMode);
  };

  const addHighlight = (text, color = '#ffeb3b') => {
    const highlight = {
      id: Date.now(),
      text,
      color,
      page: currentPage,
      timestamp: new Date().toISOString()
    };
    setHighlights(prev => [...prev, highlight]);
  };

  // Search Function
  const searchInPDF = () => {
    // This would integrate with PDF.js search functionality
    // For now, we'll simulate search results
    if (searchText.trim()) {
      addAIResponse('🔍 Search Results', `Searching for "${searchText}" in the document...`);
    }
  };

  // Theme styles
  const theme = {
    background: darkMode ? '#1a1a1a' : '#ffffff',
    surface: darkMode ? '#2d2d2d' : '#f5f5f5',
    text: darkMode ? '#ffffff' : '#000000',
    textSecondary: darkMode ? '#b0b0b0' : '#666666',
    accent: '#3498db',
    error: '#e74c3c',
    success: '#2ecc71',
    warning: '#f39c12'
  };

  const styles = {
    container: {
      display: 'flex',
      height: '100vh',
      backgroundColor: theme.background,
      color: theme.text,
      fontFamily: 'Arial, sans-serif'
    },
    sidebar: {
      width: sidebarOpen ? '350px' : '60px',
      backgroundColor: theme.surface,
      borderRight: `1px solid ${darkMode ? '#444' : '#ddd'}`,
      transition: 'width 0.3s ease',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    },
    sidebarHeader: {
      padding: '20px',
      borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    mainContent: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    },
    toolbar: {
      padding: '15px 20px',
      backgroundColor: theme.surface,
      borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap'
    },
    pdfContainer: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '20px',
      overflow: 'auto',
      backgroundColor: darkMode ? '#0f0f0f' : '#e5e5e5'
    },
    pdfPage: {
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      borderRadius: '8px',
      overflow: 'hidden'
    },
    button: {
      padding: '8px 15px',
      backgroundColor: theme.accent,
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      fontSize: '14px',
      transition: 'all 0.2s ease'
    },
    iconButton: {
      padding: '10px',
      backgroundColor: 'transparent',
      color: theme.text,
      border: `1px solid ${darkMode ? '#555' : '#ccc'}`,
      borderRadius: '6px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease'
    },
    input: {
      padding: '8px 12px',
      backgroundColor: theme.surface,
      color: theme.text,
      border: `1px solid ${darkMode ? '#555' : '#ccc'}`,
      borderRadius: '6px',
      outline: 'none'
    },
    aiPanel: {
      padding: '15px',
      borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`
    },
    aiResponse: {
      backgroundColor: darkMode ? '#333' : '#f9f9f9',
      border: `1px solid ${darkMode ? '#555' : '#ddd'}`,
      borderRadius: '8px',
      padding: '15px',
      margin: '10px 0',
      borderLeft: `4px solid ${theme.accent}`
    },
    aiResponseTitle: {
      fontWeight: 'bold',
      marginBottom: '8px',
      color: theme.accent
    },
    fileUpload: {
      display: 'none'
    },
    pageInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '0 15px'
    }
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>🤖 AI Tools</h3>
          <button 
            style={styles.iconButton}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <VisibilityOff /> : <Visibility />}
          </button>
        </div>

        {sidebarOpen && (
          <>
            {/* File Upload */}
            <div style={styles.aiPanel}>
              <h4>📁 Load PDF</h4>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={onFileChange}
                style={styles.fileUpload}
              />
              <button 
                style={styles.button}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose PDF File
              </button>
            </div>

            {/* AI Tools */}
            <div style={styles.aiPanel}>
              <h4>🧠 Text Understanding</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button style={styles.button} onClick={simplifyText} disabled={isProcessing}>
                  <Psychology fontSize="small" />
                  Simplify Text
                </button>
                <button style={styles.button} onClick={explainTerminology} disabled={isProcessing}>
                  <FindInPage fontSize="small" />
                  Explain Terms
                </button>
                <button style={styles.button} onClick={generateSummary} disabled={isProcessing}>
                  <AutoAwesome fontSize="small" />
                  Generate Summary
                </button>
              </div>
            </div>

            <div style={styles.aiPanel}>
              <h4>🔗 Analysis</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button style={styles.button} onClick={findConnections} disabled={isProcessing}>
                  <AccountTree fontSize="small" />
                  Find Connections
                </button>
                <button style={styles.button} onClick={extractKeyPoints} disabled={isProcessing}>
                  <Lightbulb fontSize="small" />
                  Key Points
                </button>
                <button style={styles.button} onClick={generateQuestions} disabled={isProcessing}>
                  <Quiz fontSize="small" />
                  Study Questions
                </button>
                <button style={styles.button} onClick={analyzeDiagram} disabled={isProcessing}>
                  📊 Analyze Diagrams
                </button>
              </div>
            </div>

            {/* AI Responses */}
            <div style={{ flex: 1, overflow: 'auto', padding: '15px' }}>
              <h4>🤖 AI Responses</h4>
              {isProcessing && (
                <div style={styles.aiResponse}>
                  <div style={styles.aiResponseTitle}>⏳ Processing...</div>
                  <div>AI is analyzing your request...</div>
                </div>
              )}
              {aiResponses.map(response => (
                <div key={response.id} style={styles.aiResponse}>
                  <div style={styles.aiResponseTitle}>{response.title}</div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {response.content}
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '8px' }}>
                    {response.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <button 
            style={styles.iconButton}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? <LightMode /> : <DarkMode />}
          </button>

          {pdfFile && (
            <>
              <button 
                style={styles.iconButton}
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <NavigateBefore />
              </button>

              <div style={styles.pageInfo}>
                <input
                  type="number"
                  value={currentPage}
                  onChange={(e) => goToPage(parseInt(e.target.value))}
                  style={{ ...styles.input, width: '60px', textAlign: 'center' }}
                  min="1"
                  max={numPages}
                />
                <span>of {numPages}</span>
              </div>

              <button 
                style={styles.iconButton}
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
              >
                <NavigateNext />
              </button>

              <div style={{ width: '20px' }} />

              <button 
                style={styles.iconButton}
                onClick={() => handleZoom(-0.2)}
              >
                <ZoomOut />
              </button>

              <span style={{ padding: '0 10px' }}>
                {Math.round(scale * 100)}%
              </span>

              <button 
                style={styles.iconButton}
                onClick={() => handleZoom(0.2)}
              >
                <ZoomIn />
              </button>

              <div style={{ width: '20px' }} />

              <input
                type="text"
                placeholder="Search in PDF..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={styles.input}
                onKeyPress={(e) => e.key === 'Enter' && searchInPDF()}
              />

              <button style={styles.button} onClick={searchInPDF}>
                <Search fontSize="small" />
                Search
              </button>

              <button 
                style={{
                  ...styles.button,
                  backgroundColor: highlightMode ? theme.warning : theme.accent
                }}
                onClick={toggleHighlight}
              >
                <Highlight fontSize="small" />
                Highlight
              </button>
            </>
          )}
        </div>

        {/* PDF Viewer */}
        <div style={styles.pdfContainer}>
          {pdfFile ? (
            <Document
              file={pdfFile}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div style={{ color: theme.text }}>Loading PDF...</div>}
              error={<div style={{ color: theme.error }}>Error loading PDF</div>}
            >
              <div 
                style={styles.pdfPage}
                onMouseUp={handleTextSelection}
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </div>
            </Document>
          ) : (
            <div style={{ textAlign: 'center', color: theme.textSecondary }}>
              <h3>Welcome to AI PDF Reader</h3>
              <p>Upload a PDF file to get started with AI-powered reading assistance</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIPDFReader;