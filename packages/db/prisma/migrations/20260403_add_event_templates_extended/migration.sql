-- LastNite — Migration: add extended event templates
-- Adds: trek, ski, wedding, costume_party to the EventTemplate enum

ALTER TYPE "EventTemplate" ADD VALUE 'trek';
ALTER TYPE "EventTemplate" ADD VALUE 'ski';
ALTER TYPE "EventTemplate" ADD VALUE 'wedding';
ALTER TYPE "EventTemplate" ADD VALUE 'costume_party';
