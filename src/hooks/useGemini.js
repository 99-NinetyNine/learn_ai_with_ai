// hooks/useGemini.js
import { useState, useRef,useEffect, useCallback } from 'react';

// import { useState, useCallback } from 'react';
import { getDocument } from 'pdfjs-dist';
// import { useState, useCallback } from 'react';
// import { useState, useCallback, useEffect } from 'react';

import { GeminiService } from '../services/geminiService';
import { useState, useCallback } from 'react';

export const useGemini = (apiKey) => {
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

// hooks/usePDF.js
// import { useState, useCallback } from 'react';
// import { getDocument } from 'pdfjs-dist';

export const usePDF = () => {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extractedText, setExtractedText] = useState('');

  const loadPDF = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const fileReader = new FileReader();
      
      fileReader.onload = async (event) => {
        try {
          const typedArray = new Uint8Array(event.target.result);
          const pdf = await getDocument(typedArray).promise;
          
          setPdfDocument(pdf);
          setNumPages(pdf.numPages);
          setCurrentPage(1);
          
          // Extract text from all pages
          await extractAllText(pdf);
          
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

  const extractAllText = async (pdf) => {
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `\n\nPage ${i}:\n${pageText}`;
      } catch (err) {
        console.warn(`Failed to extract text from page ${i}:`, err);
      }
    }
    
    setExtractedText(fullText);
  };

  const goToPage = useCallback((pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= numPages) {
      setCurrentPage(pageNumber);
    }
  }, [numPages]);

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(3, prev + 0.2));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(0.5, prev - 0.2));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1.2);
  }, []);

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
    zoomIn,
    zoomOut,
    resetZoom,
    setCurrentPage,
    setScale
  };
};

// hooks/useHighlights.js
// import { useState, useCallback } from 'react';

export const useHighlights = () => {
  const [highlights, setHighlights] = useState([]);
  const [highlightMode, setHighlightMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#ffeb3b');

  const addHighlight = useCallback((text, page, position, color = selectedColor) => {
    const highlight = {
      id: Date.now() + Math.random(),
      text: text.trim(),
      page,
      position,
      color,
      timestamp: new Date().toISOString(),
      note: ''
    };
    
    setHighlights(prev => [...prev, highlight]);
    return highlight.id;
  }, [selectedColor]);

  const removeHighlight = useCallback((id) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
  }, []);

  const updateHighlightNote = useCallback((id, note) => {
    setHighlights(prev => prev.map(h => 
      h.id === id ? { ...h, note } : h
    ));
  }, []);

  const getHighlightsForPage = useCallback((pageNumber) => {
    return highlights.filter(h => h.page === pageNumber);
  }, [highlights]);

  const exportHighlights = useCallback(() => {
    const exportData = {
      highlights,
      exportDate: new Date().toISOString(),
      totalHighlights: highlights.length
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `highlights_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }, [highlights]);

  const importHighlights = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.highlights && Array.isArray(data.highlights)) {
          setHighlights(prev => [...prev, ...data.highlights]);
        }
      } catch (err) {
        console.error('Failed to import highlights:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    highlights,
    highlightMode,
    selectedColor,
    addHighlight,
    removeHighlight,
    updateHighlightNote,
    getHighlightsForPage,
    setHighlightMode,
    setSelectedColor,
    exportHighlights,
    importHighlights
  };
};

// hooks/useTextSelection.js
// import { useState, useCallback, useEffect } from 'react';

export const useTextSelection = () => {
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
    document.addEventListener('touchend', handleSelection);
    
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
    };
  }, [handleSelection]);

  return {
    selectedText,
    selectionPosition,
    clearSelection,
    hasSelection: selectedText.length > 0
  };
};

// hooks/useSearch.js
// import { useState, useCallback } from 'react';

export const useSearch = (pdfDocument) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = useCallback(async (term) => {
    if (!pdfDocument || !term.trim()) {
      setSearchResults([]);
      setCurrentResultIndex(-1);
      return;
    }

    setIsSearching(true);
    const results = [];

    try {
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const text = textContent.items.map(item => item.str).join(' ');
        const regex = new RegExp(term, 'gi');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          results.push({
            pageNumber: pageNum,
            text: text.substring(Math.max(0, match.index - 50), match.index + term.length + 50),
            index: match.index,
            term: match[0]
          });
        }
      }
      
      setSearchResults(results);
      setCurrentResultIndex(results.length > 0 ? 0 : -1);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [pdfDocument]);

  const nextResult = useCallback(() => {
    if (searchResults.length > 0) {
      setCurrentResultIndex(prev => 
        prev < searchResults.length - 1 ? prev + 1 : 0
      );
    }
  }, [searchResults.length]);

  const previousResult = useCallback(() => {
    if (searchResults.length > 0) {
      setCurrentResultIndex(prev => 
        prev > 0 ? prev - 1 : searchResults.length - 1
      );
    }
  }, [searchResults.length]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
    setCurrentResultIndex(-1);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    currentResultIndex,
    isSearching,
    performSearch,
    nextResult,
    previousResult,
    clearSearch,
    currentResult: searchResults[currentResultIndex] || null
  };
};