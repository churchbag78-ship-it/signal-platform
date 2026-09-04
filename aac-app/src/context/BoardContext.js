import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { coreBoard } from '../data/boards';
import { loadBoard, saveBoard } from '../storage/boardStorage';

const BoardContext = createContext(null);

function makeTileId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function BoardProvider({ children }) {
  const [board, setBoard] = useState(coreBoard);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadBoard().then((stored) => {
      if (!mounted) return;
      setBoard(stored || coreBoard);
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback((nextBoard) => {
    setBoard(nextBoard);
    saveBoard(nextBoard);
  }, []);

  const addTile = useCallback(
    (tile) => {
      const next = { ...board, tiles: [...board.tiles, { ...tile, id: makeTileId() }] };
      persist(next);
      return next;
    },
    [board, persist]
  );

  const updateTile = useCallback(
    (tileId, patch) => {
      const next = {
        ...board,
        tiles: board.tiles.map((t) => (t.id === tileId ? { ...t, ...patch } : t)),
      };
      persist(next);
    },
    [board, persist]
  );

  const removeTile = useCallback(
    (tileId) => {
      const next = { ...board, tiles: board.tiles.filter((t) => t.id !== tileId) };
      persist(next);
    },
    [board, persist]
  );

  const resetToDefaultBoard = useCallback(() => {
    persist(coreBoard);
  }, [persist]);

  return (
    <BoardContext.Provider
      value={{ board, loaded, addTile, updateTile, removeTile, resetToDefaultBoard }}
    >
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoard must be used within a BoardProvider');
  return ctx;
}
