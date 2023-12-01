//
//  FFStateType.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public enum FFStateType: String, CustomStringConvertible {
    public var description: String {
        return self.rawValue
    }
    
    case START = "start",
         NEW_GAME = "new game",
         ADD_FAMILY = "add family",
         LOAD_QUESTIONS = "load questions",
         INITIALIZE_GAME = "initialize game",
         PLAY = "play",
         END_GAME = "end game",
         FAST_MONEY = "fast money"
}
