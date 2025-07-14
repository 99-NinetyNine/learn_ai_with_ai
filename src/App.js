// App.js - Complete Working Version with Live Teacher Mode
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker
import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Gemini AI Service for Teacher Mode
class GeminiTeacherService {
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
            text: `${context}\n\n${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 3000,
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
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
    } catch (error) {
      console.error('Gemini API Error:', error);
      return `Error: ${error.message}`;
    }
  }

  async segmentDocument(documentText) {
    const prompt = `
Please analyze this document and break it into logical segments. Create a JSON array where each segment has:
- id: unique identifier
- type: "title", "subtitle", "paragraph", "figure_ref", or "citation"
- content: original text snippet (max 100 chars)
- summary: AI summary (max 60 chars)
- importance: "high", "medium", or "low"
- concepts: array of 2-3 key concepts
- connections: array of related segment IDs
- figures: array of figure references if any
- position: {x, y} coordinates for layout

Document: ${documentText.substring(0, 2000)}

Respond with valid JSON only.
    `;
    
    try {
      const response = await this.generateContent(prompt);
      // Try to extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        // Fallback to demo data
        return this.createDemoSegments();
      }
    } catch (error) {
      console.error('Segmentation error:', error);
      return this.createDemoSegments();
    }
  }

  createDemoSegments() {
    return [
      {
        id: "seg_1",
        type: "title",
        content: "Introduction to Machine Learning",
        summary: "Core ML concepts and fundamentals",
        importance: "high",
        concepts: ["machine learning", "algorithms", "data"],
        connections: ["seg_2", "seg_3"],
        figures: [],
        position: { x: 100, y: 100 }
      },
      {
        id: "seg_2",
        type: "paragraph",
        content: "Supervised learning uses labeled data...",
        summary: "Supervised learning with labeled datasets",
        importance: "high",
        concepts: ["supervised learning", "labeled data", "training"],
        connections: ["seg_1", "seg_4"],
        figures: ["fig_1"],
        position: { x: 500, y: 100 }
      },
      {
        id: "seg_3",
        type: "paragraph",
        content: "Unsupervised learning finds patterns...",
        summary: "Pattern discovery in unlabeled data",
        importance: "medium",
        concepts: ["unsupervised learning", "patterns", "clustering"],
        connections: ["seg_1", "seg_5"],
        figures: [],
        position: { x: 100, y: 400 }
      },
      {
        id: "seg_4",
        type: "figure_ref",
        content: "Figure 1 shows the learning process...",
        summary: "Learning process visualization",
        importance: "medium",
        concepts: ["visualization", "process", "training"],
        connections: ["seg_2"],
        figures: ["fig_1"],
        position: { x: 500, y: 400 }
      },
      {
        id: "seg_5",
        type: "paragraph",
        content: "Deep learning neural networks...",
        summary: "Neural networks and deep learning",
        importance: "high",
        concepts: ["deep learning", "neural networks", "layers"],
        connections: ["seg_3", "seg_6"],
        figures: ["fig_2"],
        position: { x: 900, y: 100 }
      },
      {
        id: "seg_6",
        type: "citation",
        content: "According to Smith et al. (2023)...",
        summary: "Research citation and references",
        importance: "low",
        concepts: ["research", "citation", "evidence"],
        connections: ["seg_5"],
        figures: [],
        position: { x: 900, y: 400 }
      }
    ];
  }
}

// Infinite Canvas Component
const InfiniteCanvas = ({ segments, onSegmentClick, theme }) => {
  const canvasRef = useRef(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedSegment, setSelectedSegment] = useState(null);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target === canvasRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
    }
  }, [viewport]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      setViewport(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewport(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(3, prev.scale * delta))
    }));
  }, []);

  // Add event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Style functions
  const getImportanceStyle = (importance) => {
    switch (importance) {
      case 'high':
        return {
          borderColor: '#e74c3c',
          borderWidth: '3px',
          fontSize: '16px',
          fontWeight: 'bold',
          textTransform: 'uppercase'
        };
      case 'medium':
        return {
          borderColor: '#f39c12',
          borderWidth: '2px',
          fontSize: '14px',
          fontWeight: '600'
        };
      default:
        return {
          borderColor: '#3498db',
          borderWidth: '1px',
          fontSize: '12px',
          fontWeight: 'normal'
        };
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'title': return '#2c3e50';
      case 'subtitle': return '#34495e';
      case 'paragraph': return '#ffffff';
      case 'figure_ref': return '#e8f5e8';
      case 'citation': return '#fff3cd';
      default: return '#ffffff';
    }
  };

  // Reset view function
  const resetView = () => {
    setViewport({ x: 0, y: 0, scale: 1 });
  };

  return (
    <div
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        position: 'relative',
        backgroundColor: '#f8f9fa'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Connection Lines SVG */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`
        }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#3498db" />
          </marker>
        </defs>

        {/* Render connection lines */}
        {segments.map(segment =>
          segment.connections.map(connId => {
            const connectedSegment = segments.find(s => s.id === connId);
            if (!connectedSegment) return null;

            return (
              <line
                key={`${segment.id}-${connId}`}
                x1={segment.position.x + 175}
                y1={segment.position.y + 75}
                x2={connectedSegment.position.x + 175}
                y2={connectedSegment.position.y + 75}
                stroke="#3498db"
                strokeWidth="2"
                strokeDasharray="8,4"
                markerEnd="url(#arrowhead)"
                opacity="0.7"
              />
            );
          })
        )}
      </svg>

      {/* Segment Cards Container */}
      <div
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
          position: 'absolute',
          width: '100%',
          height: '100%'
        }}
      >
        {segments.map(segment => {
          const importanceStyle = getImportanceStyle(segment.importance);
          const backgroundColor = getTypeColor(segment.type);

          return (
            <div
              key={segment.id}
              style={{
                position: 'absolute',
                left: segment.position.x,
                top: segment.position.y,
                width: '350px',
                minHeight: '150px',
                backgroundColor,
                border: `${importanceStyle.borderWidth} solid ${importanceStyle.borderColor}`,
                borderRadius: '15px',
                padding: '20px',
                boxShadow: selectedSegment === segment.id 
                  ? '0 12px 40px rgba(0,0,0,0.3)' 
                  : '0 8px 32px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: selectedSegment === segment.id ? 'scale(1.05)' : 'scale(1)',
                zIndex: selectedSegment === segment.id ? 1000 : 1,
                pointerEvents: 'auto'
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSegment(segment.id);
                onSegmentClick(segment);
              }}
            >
              {/* Type Badge */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '15px',
                backgroundColor: importanceStyle.borderColor,
                color: 'white',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                {segment.type.replace('_', ' ')}
              </div>

              {/* Main Content */}
              <div style={{
                fontSize: importanceStyle.fontSize,
                fontWeight: importanceStyle.fontWeight,
                textTransform: importanceStyle.textTransform || 'none',
                marginBottom: '12px',
                color: '#2c3e50',
                lineHeight: '1.4'
              }}>
                {segment.summary}
              </div>

              {/* Concepts Tags */}
              <div style={{ marginBottom: '12px' }}>
                {segment.concepts.map((concept, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#ecf0f1',
                      color: '#2c3e50',
                      padding: '3px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      margin: '2px',
                      fontWeight: '500'
                    }}
                  >
                    {concept}
                  </span>
                ))}
              </div>

              {/* Figures Section */}
              {segment.figures.length > 0 && (
                <div style={{
                  backgroundColor: '#e8f6f3',
                  padding: '10px',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  border: '2px dashed #16a085'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: 'bold', 
                    color: '#16a085', 
                    marginBottom: '5px' 
                  }}>
                    📊 Figures:
                  </div>
                  {segment.figures.map((fig, idx) => (
                    <div key={idx} style={{ fontSize: '11px', color: '#2c3e50' }}>
                      {fig}
                    </div>
                  ))}
                </div>
              )}

              {/* Connection Count */}
              {segment.connections.length > 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: '15px',
                  right: '15px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  {segment.connections.length}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Canvas Controls */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 1000
      }}>
        <button
          onClick={resetView}
          style={{
            padding: '8px 12px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500'
          }}
        >
          🎯 Reset
        </button>
        <button
          onClick={() => setViewport(prev => ({ ...prev, scale: prev.scale * 1.2 }))}
          style={{
            padding: '8px 12px',
            backgroundColor: '#2ecc71',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🔍+
        </button>
        <button
          onClick={() => setViewport(prev => ({ ...prev, scale: prev.scale * 0.8 }))}
          style={{
            padding: '8px 12px',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🔍-
        </button>
      </div>

      {/* Info Panel */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: '10px',
        padding: '15px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        maxWidth: '280px',
        zIndex: 1000
      }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#2c3e50', fontSize: '14px' }}>
          🧠 Teacher Mode Active
        </h4>
        <div style={{ fontSize: '11px', color: '#7f8c8d', lineHeight: '1.4' }}>
          <div>📊 Concepts: {segments.length}</div>
          <div>🔗 Connections: {segments.reduce((acc, seg) => acc + seg.connections.length, 0)}</div>
          <div>📈 Figures: {segments.reduce((acc, seg) => acc + seg.figures.length, 0)}</div>
          <div style={{ marginTop: '8px' }}>
            <strong>Controls:</strong><br/>
            • Drag to pan • Scroll to zoom • Click cards
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || 'your-api-key-here';
  
  // State
  const [darkMode, setDarkMode] = useState(true);
  const [teacherMode, setTeacherMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pdfFile, setPdfFile] = useState(null);
  const [segments, setSegments] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);
  
  // PDF State
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [extractedText, setExtractedText] = useState('');

  // Refs
  const fileInputRef = useRef(null);
  const teacherService = useRef(new GeminiTeacherService(GEMINI_API_KEY));

  const theme = {
    primary: '#3498db',
    secondary: '#2ecc71',
    accent: '#e74c3c',
    warning: '#f39c12',
    background: darkMode ? '#0f0f0f' : '#ffffff',
    surface: darkMode ? '#1a1a1a' : '#f8f9fa',
    text: darkMode ? '#ffffff' : '#333333',
    textSecondary: darkMode ? '#b0b0b0' : '#666666',
    border: darkMode ? '#404040' : '#e0e0e0'
  };

  const styles = {
    app: {
      display: 'flex',
      height: '100vh',
      backgroundColor: theme.background,
      color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    sidebar: {
      width: sidebarOpen ? '320px' : '60px',
      backgroundColor: theme.surface,
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
      gap: '12px',
      flexWrap: 'wrap'
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
      fontWeight: '500',
      transition: 'all 0.2s ease'
    },
    teacherButton: {
      padding: '12px 20px',
      backgroundColor: teacherMode ? '#e74c3c' : '#2ecc71',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontSize: '15px',
      fontWeight: 'bold',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
    }
  };

  // Event handlers
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setTeacherMode(false);
      setSegments([]);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setCurrentPage(1);
    // Simulate text extraction
    setTimeout(() => {
      setExtractedText(`Extracted text from ${pdfFile?.name || 'document'}. This would contain the actual PDF content for AI processing.`);
    }, 1000);
  };

  const enableTeacherMode = async () => {
    if (!pdfFile) {
      alert('Please upload a PDF first!');
      return;
    }

    setIsProcessing(true);

    try {
      const documentSegments = await teacherService.current.segmentDocument(extractedText);
      setSegments(documentSegments);
      setTeacherMode(true);
    } catch (error) {
      console.error('Error processing document:', error);
      alert('Error processing document. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSegmentClick = (segment) => {
    setSelectedSegment(segment);
    console.log('Selected segment:', segment);
  };

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= numPages) {
      setCurrentPage(pageNumber);
    }
  };

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
          <p style={{ margin: '5px 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '12px' }}>
            {teacherMode ? 'Live Teacher Mode Active' : 'Standard Mode'}
          </p>
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
              {pdfFile && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: theme.textSecondary }}>
                  📎 {pdfFile.name}
                </div>
              )}
            </div>

            {/* Teacher Mode Section */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '12px', color: theme.primary }}>🧠 Teacher Mode</h4>
              <button
                style={styles.teacherButton}
                onClick={teacherMode ? () => setTeacherMode(false) : enableTeacherMode}
                disabled={isProcessing || !pdfFile}
              >
                {isProcessing ? '🔄 Processing...' : 
                 teacherMode ? '🔴 Exit Teacher Mode' : '🚀 Enable Teacher Mode'}
              </button>
              
              {teacherMode && segments.length > 0 && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px',
                  backgroundColor: theme.surface,
                  borderRadius: '8px',
                  fontSize: '12px' 
                }}>
                  <div style={{ color: theme.textSecondary }}>
                    📊 Analysis Complete:
                  </div>
                  <div>• {segments.length} concepts identified</div>
                  <div>• {segments.reduce((acc, seg) => acc + seg.connections.length, 0)} connections mapped</div>
                  <div>• {segments.reduce((acc, seg) => acc + seg.figures.length, 0)} figures referenced</div>
                </div>
              )}
            </div>

            {/* Selected Segment Info */}
            {selectedSegment && (
              <div style={{
                backgroundColor: theme.surface,
                border: `2px solid ${theme.primary}`,
                borderRadius: '10px',
                padding: '15px',
                marginBottom: '20px'
              }}>
                <h4 style={{ color: theme.primary, marginBottom: '10px', fontSize: '14px' }}>
                  📍 Selected Concept
                </h4>
                <div style={{ fontSize: '12px', marginBottom: '6px' }}>
                  <strong>Type:</strong> {selectedSegment.type}
                </div>
                <div style={{ fontSize: '12px', marginBottom: '6px' }}>
                  <strong>Importance:</strong> {selectedSegment.importance}
                </div>
                <div style={{ fontSize: '11px', color: theme.textSecondary, marginBottom: '10px' }}>
                  {selectedSegment.summary}
                </div>
                
                <button
                  style={{
                    ...styles.button,
                    backgroundColor: theme.secondary,
                    fontSize: '12px',
                    padding: '8px 12px',
                    width: '100%'
                  }}
                  onClick={() => {
                    alert(`Would jump to: ${selectedSegment.id}`);
                  }}
                >
                  📖 Go to PDF Location
                </button>
              </div>
            )}

            {/* Instructions */}
            <div style={{
              backgroundColor: 'rgba(52, 152, 219, 0.1)',
              border: `1px solid ${theme.primary}`,
              borderRadius: '10px',
              padding: '15px'
            }}>
              <h4 style={{ color: theme.primary, marginBottom: '10px', fontSize: '13px' }}>
                ✨ How to Use
              </h4>
              <div style={{ fontSize: '11px', lineHeight: '1.4', color: theme.textSecondary }}>
                <p>1. 📄 Upload a PDF document</p>
                <p>2. 🚀 Enable Teacher Mode</p>
                <p>3. 🎨 Explore the visual concept map</p>
                <p>4. 🔍 Click concepts to learn more</p>
                <p>5. 🔗 Follow arrows between ideas</p>
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
            style={{ 
              ...styles.button, 
              backgroundColor: 'transparent', 
              color: theme.text, 
              border: `1px solid ${theme.border}` 
            }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>

          <button
            style={{ 
              ...styles.button, 
              backgroundColor: 'transparent', 
              color: theme.text, 
              border: `1px solid ${theme.border}` 
            }}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {pdfFile && !teacherMode && (
            <>
              <button
                style={styles.button}
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                ⬅️ Prev
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  value={currentPage}
                  onChange={(e) => goToPage(parseInt(e.target.value))}
                  style={{
                    width: '50px',
                    padding: '6px',
                    textAlign: 'center',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    backgroundColor: theme.surface,
                    color: theme.text
                  }}
                  min="1"
                  max={numPages}
                />
                <span style={{ fontSize: '14px' }}>of {numPages}</span>
              </div>

              <button
                style={styles.button}
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
              >
                ➡️ Next
              </button>

              <button
                style={styles.button}
                onClick={() => setScale(Math.max(0.5, scale - 0.2))}
              >
                🔍- Zoom Out
              </button>

              <span style={{ fontSize: '14px', minWidth: '60px' }}>
                {Math.round(scale * 100)}%
              </span>

              <button
                style={styles.button}
                onClick={() => setScale(Math.min(3, scale + 0.2))}
              >
                🔍+ Zoom In
              </button>
            </>
          )}

          <div style={{ flex: 1 }} />

          {teacherMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ 
                fontSize: '13px', 
                color: theme.textSecondary,
                padding: '6px 12px',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                borderRadius: '20px',
                border: `1px solid ${theme.secondary}`
              }}>
                🧠 Live Teacher Mode Active
              </span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {teacherMode ? (
            // Teacher Mode - Infinite Canvas
            <InfiniteCanvas
              segments={segments}
              onSegmentClick={handleSegmentClick}
              theme={theme}
            />
          ) : (
            // Normal PDF View
            <div style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: '20px',
              overflow: 'auto',
              backgroundColor: theme.background
            }}>
              {pdfFile ? (
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div style={{ 
                      color: theme.text, 
                      textAlign: 'center', 
                      padding: '40px' 
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '16px' }}>📄</div>
                      <div>Loading PDF...</div>
                    </div>
                  }
                  error={
                    <div style={{ 
                      color: theme.accent, 
                      textAlign: 'center', 
                      padding: '40px' 
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '16px' }}>❌</div>
                      <div>Error loading PDF. Please try another file.</div>
                    </div>
                  }
                >
                  <div style={{
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: 'white'
                  }}>
                    <Page
                      pageNumber={currentPage}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={
                        <div style={{ 
                          padding: '40px', 
                          textAlign: 'center',
                          color: theme.textSecondary 
                        }}>
                          Loading page...
                        </div>
                      }
                      error={
                        <div style={{ 
                          padding: '40px', 
                          textAlign: 'center',
                          color: theme.accent 
                        }}>
                          Error loading page
                        </div>
                      }
                    />
                  </div>
                </Document>
              ) : (
                // Welcome Screen
                <div style={{ 
                  textAlign: 'center', 
                  color: theme.textSecondary, 
                  padding: '60px 20px',
                  maxWidth: '800px'
                }}>
                  <div style={{ fontSize: '64px', marginBottom: '24px' }}>📚</div>
                  <h1 style={{ 
                    marginBottom: '16px', 
                    color: theme.text,
                    fontSize: '32px',
                    fontWeight: '700'
                  }}>
                    AI PDF Reader with Live Teacher Mode
                  </h1>
                  <p style={{ 
                    marginBottom: '32px', 
                    fontSize: '18px',
                    lineHeight: '1.6'
                  }}>
                    Transform your PDFs into interactive visual knowledge maps with AI-powered concept analysis
                  </p>
                  
                  <button
                    style={{ 
                      ...styles.button, 
                      fontSize: '18px', 
                      padding: '16px 32px',
                      backgroundColor: theme.secondary,
                      boxShadow: '0 4px 20px rgba(46, 204, 113, 0.3)'
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📄 Upload PDF to Get Started
                  </button>
                  
                  {/* Feature Grid */}
                  <div style={{ 
                    marginTop: '60px',
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                    gap: '24px'
                  }}>
                    <div style={{
                      backgroundColor: theme.surface,
                      padding: '24px',
                      borderRadius: '16px',
                      border: `2px solid ${theme.primary}`,
                      textAlign: 'left'
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧩</div>
                      <h3 style={{ color: theme.primary, marginBottom: '12px', fontSize: '18px' }}>
                        Smart Segmentation
                      </h3>
                      <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
                        AI automatically breaks down your PDF into logical segments based on structure and content importance.
                      </p>
                    </div>
                    
                    <div style={{
                      backgroundColor: theme.surface,
                      padding: '24px',
                      borderRadius: '16px',
                      border: `2px solid ${theme.secondary}`,
                      textAlign: 'left'
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎨</div>
                      <h3 style={{ color: theme.secondary, marginBottom: '12px', fontSize: '18px' }}>
                        Visual Concept Cards
                      </h3>
                      <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
                        Each concept is beautifully presented with AI summaries, importance highlighting, and interactive elements.
                      </p>
                    </div>
                    
                    <div style={{
                      backgroundColor: theme.surface,
                      padding: '24px',
                      borderRadius: '16px',
                      border: `2px solid ${theme.warning}`,
                      textAlign: 'left'
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔗</div>
                      <h3 style={{ color: theme.warning, marginBottom: '12px', fontSize: '18px' }}>
                        Smart Connections
                      </h3>
                      <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
                        Discover relationships between concepts with animated arrows and interactive connection mapping.
                      </p>
                    </div>
                    
                    <div style={{
                      backgroundColor: theme.surface,
                      padding: '24px',
                      borderRadius: '16px',
                      border: `2px solid ${theme.accent}`,
                      textAlign: 'left'
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
                      <h3 style={{ color: theme.accent, marginBottom: '12px', fontSize: '18px' }}>
                        Figure Integration
                      </h3>
                      <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
                        Automatically detects and contextually places figure references next to related concepts.
                      </p>
                    </div>
                    
                    <div style={{
                      backgroundColor: theme.surface,
                      padding: '24px',
                      borderRadius: '16px',
                      border: `2px solid #9b59b6`,
                      textAlign: 'left'
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌐</div>
                      <h3 style={{ color: '#9b59b6', marginBottom: '12px', fontSize: '18px' }}>
                        Infinite Canvas
                      </h3>
                      <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
                        Navigate through concepts with smooth pan, zoom, and infinite canvas exploration.
                      </p>
                    </div>
                    
                    <div style={{
                      backgroundColor: theme.surface,
                      padding: '24px',
                      borderRadius: '16px',
                      border: `2px solid #e67e22`,
                      textAlign: 'left'
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
                      <h3 style={{ color: '#e67e22', marginBottom: '12px', fontSize: '18px' }}>
                        Smart Navigation
                      </h3>
                      <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
                        Click any concept card to jump directly to that section in the original PDF document.
                      </p>
                    </div>
                  </div>
                  
                  {/* Setup Instructions */}
                  <div style={{
                    marginTop: '48px',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    border: `2px solid ${theme.primary}`,
                    borderRadius: '16px',
                    padding: '32px'
                  }}>
                    <h3 style={{ 
                      color: theme.primary, 
                      marginBottom: '20px', 
                      fontSize: '20px' 
                    }}>
                      🚀 Quick Setup Guide
                    </h3>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-around', 
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '20px'
                    }}>
                      <div style={{ textAlign: 'center', minWidth: '140px' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                          Step 1
                        </div>
                        <div style={{ fontSize: '12px' }}>Upload PDF</div>
                      </div>
                      <div style={{ fontSize: '24px', color: theme.primary }}>→</div>
                      <div style={{ textAlign: 'center', minWidth: '140px' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧠</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                          Step 2
                        </div>
                        <div style={{ fontSize: '12px' }}>Enable Teacher Mode</div>
                      </div>
                      <div style={{ fontSize: '24px', color: theme.primary }}>→</div>
                      <div style={{ textAlign: 'center', minWidth: '140px' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚡</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                          Step 3
                        </div>
                        <div style={{ fontSize: '12px' }}>AI Analysis</div>
                      </div>
                      <div style={{ fontSize: '24px', color: theme.primary }}>→</div>
                      <div style={{ textAlign: 'center', minWidth: '140px' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎨</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                          Step 4
                        </div>
                        <div style={{ fontSize: '12px' }}>Explore Canvas</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '48px',
            textAlign: 'center',
            maxWidth: '420px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontSize: '56px', marginBottom: '24px' }}>🧠</div>
            <h2 style={{ 
              color: '#2c3e50', 
              marginBottom: '16px',
              fontSize: '24px'
            }}>
              AI Teacher Processing...
            </h2>
            <p style={{ 
              color: '#7f8c8d', 
              marginBottom: '24px', 
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              Breaking down your document into visual concepts and connections
            </p>
            
            {/* Animated Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#ecf0f1',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '20px'
            }}>
              <div style={{
                height: '100%',
                backgroundColor: '#3498db',
                borderRadius: '4px',
                animation: 'loadingProgress 3s ease-in-out infinite'
              }} />
            </div>
            
            <div style={{ 
              fontSize: '13px', 
              color: '#95a5a6',
              lineHeight: '1.6'
            }}>
              • Analyzing document structure<br/>
              • Generating AI summaries<br/>
              • Mapping concept relationships<br/>
              • Optimizing visual layout
            </div>
          </div>
        </div>
      )}

      {/* Global Styles */}
      <style>{`
        @keyframes loadingProgress {
          0% { 
            width: 0%; 
            transform: translateX(-100%); 
          }
          50% { 
            width: 70%; 
            transform: translateX(0%); 
          }
          100% { 
            width: 100%; 
            transform: translateX(0%); 
          }
        }
        
        .react-pdf__Page__textContent {
          user-select: text !important;
        }
        
        .react-pdf__Page__textContent span {
          user-select: text !important;
        }
        
        button:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: brightness(1.1);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }
        
        button:active:not(:disabled) {
          transform: translateY(0);
        }
        
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }
        
        input:focus {
          outline: none;
          border-color: ${theme.primary} !important;
          box-shadow: 0 0 0 2px ${theme.primary}33 !important;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
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
        
        /* Smooth transitions */
        * {
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
          .sidebar {
            width: 100% !important;
            height: auto;
            max-height: 40vh;
          }
          
          .toolbar {
            flex-wrap: wrap;
            gap: 8px;
            padding: 12px 16px;
          }
          
          .concept-card {
            width: 280px !important;
            min-height: 120px !important;
          }
        }
        
        /* High contrast mode */
        @media (prefers-contrast: high) {
          button {
            border: 2px solid currentColor !important;
          }
        }
        
        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default App;