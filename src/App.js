// App.js - Complete Working AI PDF Reader
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// Gemini AI Service
class GeminiService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
  }

  async generateContent(prompt, context = '') {
    if (!this.apiKey || this.apiKey === 'your-api-key-here') {
      return 'Please add your Gemini API key to the .env file as REACT_APP_GEMINI_API_KEY';
    }

    try {
      const requestBody = {
        contents: [{
          parts: [{
            text: `Context: ${context}\n\nRequest: ${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
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
      return `Error: ${error.message}. Please check your API key and internet connection.`;
    }
  }

  async simplifyText(selectedText, documentContext = '') {
    const prompt = `Please simplify and explain this text in easy-to-understand language: "${selectedText}"`;
    return this.generateContent(prompt, documentContext);
  }

  async explainTerminology(selectedText, documentContext = '') {
    const prompt = `Identify and explain technical terms and concepts in this text: "${selectedText}"`;
    return this.generateContent(prompt, documentContext);
  }

  async generateSummary(documentContext) {
    const prompt = 'Generate a comprehensive summary of this document including key points and main conclusions.';
    return this.generateContent(prompt, documentContext);
  }

  async findConnections(documentContext, selectedText = '') {
    const prompt = `Analyze relationships and connections between concepts in this document. ${selectedText ? `Focus on: "${selectedText}"` : ''}`;
    return this.generateContent(prompt, documentContext);
  }

  async extractKeyPoints(documentContext) {
    const prompt = 'Extract the most important key points and insights from this document. Present as a clear list.';
    return this.generateContent(prompt, documentContext);
  }

  async generateQuestions(documentContext, selectedText = '') {
    const prompt = `Generate study questions at different levels (comprehension, analysis, critical thinking) based on this content. ${selectedText ? `Focus on: "${selectedText}"` : ''}`;
    return this.generateContent(prompt, documentContext);
  }

  async analyzeDiagram(documentContext) {
    const prompt = 'Analyze any diagrams, charts, or visual elements mentioned in this content and explain their significance.';
    return this.generateContent(prompt, documentContext);
  }
}

// Custom Hooks
const useGemini = (apiKey) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const geminiService = useRef(new GeminiService(apiKey));

  const callAI = useCallback(async (method, ...args) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await geminiService.current[method](...args);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    callAI,
    clearError: () => setError(null)
  };
};

const usePDF = () => {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extractedText, setExtractedText] = useState('');

  const extractTextFromPDF = async (pdf) => {
    let fullText = '';
    
    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) { // Limit to first 10 pages for performance
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `Page ${i}: ${pageText}\n\n`;
      } catch (err) {
        console.warn(`Failed to extract text from page ${i}:`, err);
      }
    }
    
    setExtractedText(fullText);
  };

  const loadPDF = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const fileReader = new FileReader();
      
      fileReader.onload = async (event) => {
        try {
          const typedArray = new Uint8Array(event.target.result);
          const loadingTask = pdfjs.getDocument(typedArray);
          const pdf = await loadingTask.promise;
          
          setPdfDocument(pdf);
          setNumPages(pdf.numPages);
          setCurrentPage(1);
          
          // Extract text from PDF
          await extractTextFromPDF(pdf);
          
        } catch (err) {
          setError(`Failed to load PDF: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      };
      
      fileReader.readAsArrayBuffer(file);
    } catch (err) {
      setError(`File reading error: ${err.message}`);
      setIsLoading(false);
    }
  }, []);

  const goToPage = useCallback((pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= numPages) {
      setCurrentPage(pageNumber);
    }
  }, [numPages]);

  return {
    pdfDocument,
    numPages,
    currentPage,
    scale,
    isLoading,
    error,
    extractedText,
    loadPDF,
    goToPage,
    setScale,
    setCurrentPage
  };
};

const useTextSelection = () => {
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState(null);

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && text.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectedText(text);
      setSelectionPosition({
        x: rect.left + rect.width / 2,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    } else {
      setSelectedText('');
      setSelectionPosition(null);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedText('');
    setSelectionPosition(null);
    window.getSelection().removeAllRanges();
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, [handleSelection]);

  return {
    selectedText,
    selectionPosition,
    clearSelection,
    hasSelection: selectedText.length > 0
  };
};

const useHighlights = () => {
  const [highlights, setHighlights] = useState([]);
  const [highlightMode, setHighlightMode] = useState(false);

  const addHighlight = useCallback((text, page) => {
    const highlight = {
      id: Date.now() + Math.random(),
      text: text.trim(),
      page,
      color: '#ffeb3b',
      timestamp: new Date().toISOString()
    };
    
    setHighlights(prev => [...prev, highlight]);
    return highlight.id;
  }, []);

  const removeHighlight = useCallback((id) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
  }, []);

  return {
    highlights,
    highlightMode,
    addHighlight,
    removeHighlight,
    setHighlightMode
  };
};

// Main App Component
const App = () => {
  // Get API key from environment
  const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || 'your-api-key-here';
  
  // State
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [pdfFile, setPdfFile] = useState(null);
  const [aiResponses, setAiResponses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Refs
  const fileInputRef = useRef(null);

  // Custom Hooks
  const { isLoading: aiLoading, error: aiError, callAI, clearError } = useGemini(GEMINI_API_KEY);
  const {
    pdfDocument, numPages, currentPage, scale, isLoading: pdfLoading,
    error: pdfError, extractedText, loadPDF, goToPage, setScale
  } = usePDF();
  const { selectedText, selectionPosition, clearSelection, hasSelection } = useTextSelection();
  const { highlights, highlightMode, addHighlight, removeHighlight, setHighlightMode } = useHighlights();

  // Theme
  const theme = {
    primary: '#3498db',
    secondary: '#2ecc71',
    accent: '#e74c3c',
    warning: '#f39c12',
    background: darkMode ? '#0f0f0f' : '#ffffff',
    surface: darkMode ? '#1a1a1a' : '#f8f9fa',
    sidebar: darkMode ? '#2d2d2d' : '#ffffff',
    text: darkMode ? '#ffffff' : '#333333',
    textSecondary: darkMode ? '#b0b0b0' : '#666666',
    border: darkMode ? '#404040' : '#e0e0e0'
  };

  // Styles
  const styles = {
    app: {
      display: 'flex',
      height: '100vh',
      backgroundColor: theme.background,
      color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    sidebar: {
      width: sidebarOpen ? '350px' : '60px',
      backgroundColor: theme.sidebar,
      borderRight: `1px solid ${theme.border}`,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s ease',
      overflow: 'hidden'
    },
    mainContent: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    },
    toolbar: {
      padding: '15px 20px',
      backgroundColor: theme.surface,
      borderBottom: `1px solid ${theme.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap'
    },
    contentArea: {
      flex: 1,
      display: 'flex',
      overflow: 'hidden'
    },
    pdfContainer: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '20px',
      overflow: 'auto',
      backgroundColor: theme.background
    },
    aiPanel: {
      width: aiPanelOpen ? '400px' : '0',
      backgroundColor: theme.surface,
      borderLeft: `1px solid ${theme.border}`,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s ease',
      overflow: 'hidden'
    },
    button: {
      padding: '10px 16px',
      backgroundColor: theme.primary,
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      transition: 'all 0.2s ease'
    },
    iconButton: {
      padding: '10px',
      backgroundColor: 'transparent',
      color: theme.text,
      border: `1px solid ${theme.border}`,
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    input: {
      padding: '10px 14px',
      backgroundColor: theme.surface,
      color: theme.text,
      border: `1px solid ${theme.border}`,
      borderRadius: '8px',
      outline: 'none'
    }
  };

  // Event Handlers
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      loadPDF(file);
    }
  };

  const addAIResponse = (title, content, type = 'info') => {
    const response = {
      id: Date.now(),
      title,
      content,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setAiResponses(prev => [response, ...prev.slice(0, 4)]);
  };

  // AI Functions
  const simplifyText = async () => {
    if (!hasSelection) {
      addAIResponse('⚠️ No Text Selected', 'Please select some text first.');
      return;
    }
    
    try {
      const response = await callAI('simplifyText', selectedText, extractedText);
      addAIResponse('🔍 Simplified Text', response);
    } catch (error) {
      addAIResponse('❌ Error', error.message, 'error');
    }
  };

  const explainTerminology = async () => {
    if (!hasSelection) {
      addAIResponse('⚠️ No Text Selected', 'Please select some text first.');
      return;
    }
    
    try {
      const response = await callAI('explainTerminology', selectedText, extractedText);
      addAIResponse('📚 Terminology Explained', response);
    } catch (error) {
      addAIResponse('❌ Error', error.message, 'error');
    }
  };

  const generateSummary = async () => {
    try {
      const response = await callAI('generateSummary', extractedText);
      addAIResponse('📋 Document Summary', response);
    } catch (error) {
      addAIResponse('❌ Error', error.message, 'error');
    }
  };

  const findConnections = async () => {
    try {
      const response = await callAI('findConnections', extractedText, selectedText);
      addAIResponse('🔗 Content Connections', response);
    } catch (error) {
      addAIResponse('❌ Error', error.message, 'error');
    }
  };

  const extractKeyPoints = async () => {
    try {
      const response = await callAI('extractKeyPoints', extractedText);
      addAIResponse('💡 Key Points', response);
    } catch (error) {
      addAIResponse('❌ Error', error.message, 'error');
    }
  };

  const generateQuestions = async () => {
    try {
      const response = await callAI('generateQuestions', extractedText, selectedText);
      addAIResponse('❓ Study Questions', response);
    } catch (error) {
      addAIResponse('❌ Error', error.message, 'error');
    }
  };

  const analyzeDiagram = async () => {
    try {
      const response = await callAI('analyzeDiagram', extractedText);
      addAIResponse('📊 Diagram Analysis', response);
    } catch (error) {
      addAIResponse('❌ Error', error.message, 'error');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            generateSummary();
            break;
          case 'q':
            e.preventDefault();
            generateQuestions();
            break;
          default:
            break;
        }
      }
      
      if (!e.ctrlKey && !e.metaKey) {
        switch (e.key) {
          case 'ArrowLeft':
            goToPage(currentPage - 1);
            break;
          case 'ArrowRight':
            goToPage(currentPage + 1);
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, goToPage, generateSummary, generateQuestions]);

  return (
    <div style={styles.app}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={{ 
          padding: '20px', 
          borderBottom: `1px solid ${theme.border}`,
          background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`
        }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '18px' }}>
            🤖 AI PDF Reader
          </h2>
        </div>

        {sidebarOpen && (
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            {/* File Upload */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '10px', color: theme.primary }}>📁 Load PDF</h4>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                style={styles.button}
                onClick={() => fileInputRef.current?.click()}
              >
                📄 Choose PDF File
              </button>
            </div>

            {/* AI Tools */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '15px', color: theme.primary }}>🧠 AI Tools</h4>
              <div style={{ display: 'grid', gap: '10px' }}>
                <button style={styles.button} onClick={simplifyText} disabled={aiLoading}>
                  🔍 Simplify Text
                </button>
                <button style={styles.button} onClick={explainTerminology} disabled={aiLoading}>
                  📚 Explain Terms
                </button>
                <button style={styles.button} onClick={generateSummary} disabled={aiLoading}>
                  📋 Summary
                </button>
                <button style={styles.button} onClick={findConnections} disabled={aiLoading}>
                  🔗 Find Connections
                </button>
                <button style={styles.button} onClick={extractKeyPoints} disabled={aiLoading}>
                  💡 Key Points
                </button>
                <button style={styles.button} onClick={generateQuestions} disabled={aiLoading}>
                  ❓ Study Questions
                </button>
                <button style={styles.button} onClick={analyzeDiagram} disabled={aiLoading}>
                  📊 Analyze Diagrams
                </button>
              </div>
            </div>

            {/* Highlights */}
            <div>
              <h4 style={{ marginBottom: '15px', color: theme.primary }}>🎨 Highlights</h4>
              <button
                style={{
                  ...styles.button,
                  backgroundColor: highlightMode ? theme.warning : theme.primary
                }}
                onClick={() => setHighlightMode(!highlightMode)}
              >
                ✨ {highlightMode ? 'Exit Highlight' : 'Highlight Mode'}
              </button>
              
              <div style={{ marginTop: '10px', maxHeight: '200px', overflow: 'auto' }}>
                {highlights.map(highlight => (
                  <div
                    key={highlight.id}
                    style={{
                      padding: '8px',
                      margin: '5px 0',
                      backgroundColor: theme.surface,
                      borderRadius: '6px',
                      borderLeft: `4px solid ${highlight.color}`,
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      Page {highlight.page}
                    </div>
                    <div style={{ color: theme.textSecondary }}>
                      {highlight.text.substring(0, 50)}...
                    </div>
                    <button
                      onClick={() => removeHighlight(highlight.id)}
                      style={{
                        marginTop: '5px',
                        padding: '2px 6px',
                        fontSize: '10px',
                        backgroundColor: theme.accent,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <button
            style={styles.iconButton}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>

          <button
            style={styles.iconButton}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {pdfFile && (
            <>
              <button
                style={styles.iconButton}
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                ⬅️
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                ➡️
              </button>

              <button
                style={styles.iconButton}
                onClick={() => setScale(scale - 0.2)}
              >
                🔍-
              </button>

              <span>{Math.round(scale * 100)}%</span>

              <button
                style={styles.iconButton}
                onClick={() => setScale(scale + 0.2)}
              >
                🔍+
              </button>

              <input
                type="text"
                placeholder="Search in PDF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ ...styles.input, minWidth: '200px' }}
              />

              <button style={styles.button}>
                🔍 Search
              </button>
            </>
          )}

          <div style={{ flex: 1 }} />

          <button
            style={styles.iconButton}
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
          >
            🤖
          </button>
        </div>

        {/* Content Area */}
        <div style={styles.contentArea}>
          {/* PDF Viewer */}
          <div style={styles.pdfContainer}>
            {pdfFile ? (
              <Document
                file={pdfFile}
                loading={<div style={{ color: theme.text }}>📄 Loading PDF...</div>}
                error={<div style={{ color: theme.accent }}>❌ Error loading PDF</div>}
              >
                <div style={{
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                  
                  {/* Selection Tooltip */}
                  {hasSelection && selectionPosition && (
                    <div
                      style={{
                        position: 'fixed',
                        left: selectionPosition.x,
                        top: selectionPosition.y - 60,
                        backgroundColor: theme.sidebar,
                        color: theme.text,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        fontSize: '12px',
                        zIndex: 1000,
                        display: 'flex',
                        gap: '8px'
                      }}
                    >
                      <button
                        onClick={simplifyText}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          backgroundColor: theme.primary,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Simplify
                      </button>
                      <button
                        onClick={explainTerminology}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          backgroundColor: theme.secondary,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Explain
                      </button>
                      {highlightMode && (
                        <button
                          onClick={() => {
                            addHighlight(selectedText, currentPage);
                            clearSelection();
                          }}
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            backgroundColor: theme.warning,
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Highlight
                        </button>
                      )}
                      <button
                        onClick={clearSelection}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          backgroundColor: theme.accent,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </Document>
            ) : (
              <div style={{ textAlign: 'center', color: theme.textSecondary, padding: '60px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>📚</div>
                <h2 style={{ marginBottom: '10px', color: theme.text }}>
                  Welcome to AI PDF Reader
                </h2>
                <p style={{ marginBottom: '30px', fontSize: '16px' }}>
                  Upload a PDF file to get started with AI-powered reading assistance
                </p>
                <button
                  style={{ ...styles.button, fontSize: '16px', padding: '15px 30px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  📄 Choose PDF File
                </button>
              </div>
            )}
          </div>

          {/* AI Assistant Panel */}
          <div style={styles.aiPanel}>
            {aiPanelOpen && (
              <>
                <div style={{
                  padding: '20px',
                  borderBottom: `1px solid ${theme.border}`,
                  background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`
                }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>
                    🤖 AI Assistant
                  </h3>
                  <p style={{ margin: '5px 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>
                    {aiLoading ? 'Processing...' : 'Ready to help'}
                  </p>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
                  {aiError && (
                    <div style={{
                      backgroundColor: theme.accent,
                      color: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '15px'
                    }}>
                      ⚠️ {aiError}
                      <button
                        onClick={clearError}
                        style={{
                          marginLeft: '10px',
                          padding: '2px 8px',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {aiLoading && (
                    <div style={{
                      backgroundColor: theme.surface,
                      padding: '20px',
                      borderRadius: '8px',
                      marginBottom: '15px',
                      textAlign: 'center',
                      border: `1px solid ${theme.border}`
                    }}>
                      <div style={{ marginBottom: '10px' }}>🤔 AI is thinking...</div>
                      <div style={{
                        width: '100%',
                        height: '4px',
                        backgroundColor: theme.border,
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: '60%',
                          height: '100%',
                          backgroundColor: theme.primary,
                          animation: 'loading 1.5s ease-in-out infinite'
                        }} />
                      </div>
                    </div>
                  )}

                  {aiResponses.length === 0 && !aiLoading && (
                    <div style={{
                      backgroundColor: theme.surface,
                      padding: '20px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      border: `1px solid ${theme.border}`
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '15px' }}>🚀</div>
                      <h4 style={{ color: theme.text, marginBottom: '10px' }}>Ready to assist!</h4>
                      <p style={{ color: theme.textSecondary, fontSize: '14px', marginBottom: '15px' }}>
                        Select text and use AI tools, or try keyboard shortcuts:
                      </p>
                      <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                        <div>Ctrl+S - Generate Summary</div>
                        <div>Ctrl+Q - Study Questions</div>
                        <div>← → - Navigate pages</div>
                      </div>
                    </div>
                  )}

                  {aiResponses.map((response, index) => (
                    <div
                      key={response.id}
                      style={{
                        backgroundColor: theme.surface,
                        border: `1px solid ${theme.border}`,
                        borderLeft: `4px solid ${
                          response.type === 'error' ? theme.accent : theme.primary
                        }`,
                        borderRadius: '8px',
                        padding: '15px',
                        marginBottom: '15px'
                      }}
                    >
                      <div style={{
                        fontWeight: 'bold',
                        marginBottom: '10px',
                        color: theme.text,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>{response.title}</span>
                        <span style={{ 
                          fontSize: '12px', 
                          color: theme.textSecondary,
                          fontWeight: 'normal'
                        }}>
                          {response.timestamp}
                        </span>
                      </div>
                      <div style={{
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.6',
                        color: theme.text,
                        fontSize: '14px'
                      }}>
                        {response.content}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Global Styles */}
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        
        .react-pdf__Page__textContent {
          user-select: text !important;
        }
        
        .react-pdf__Page__textContent span {
          user-select: text !important;
        }
        
        button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }
        
        button:active:not(:disabled) {
          transform: translateY(0);
        }
        
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        input:focus {
          border-color: ${theme.primary} !important;
          box-shadow: 0 0 0 2px ${theme.primary}33 !important;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: ${theme.border};
        }
        
        ::-webkit-scrollbar-thumb {
          background: ${theme.primary};
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: ${theme.secondary};
        }

        ::selection {
          background: rgba(52, 152, 219, 0.3);
          color: inherit;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .app {
            flex-direction: column;
          }
          
          .sidebar {
            width: 100% !important;
            height: auto;
            max-height: 200px;
            overflow-y: auto;
          }
          
          .ai-panel {
            width: 100% !important;
            height: 300px;
            border-left: none !important;
            border-top: 1px solid ${theme.border};
          }
          
          .toolbar {
            flex-wrap: wrap;
            gap: 5px;
          }
          
          .pdf-container {
            padding: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default App;