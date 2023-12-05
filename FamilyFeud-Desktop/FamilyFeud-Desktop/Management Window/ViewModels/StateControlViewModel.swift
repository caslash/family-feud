//
//  StateControlViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/4/23.
//

import FeudKit
import Foundation
import Observation

class StateControlViewModel {
    private var game: FamilyFeudGame
    
    init(game: FamilyFeudGame) {
        self.game = game
    }
    
    func startGame() {
        _ = game.changeState(type: FFStateType.NEW_GAME)
    }
    
    func loadQuestions() {
        _ = game.changeState(type: FFStateType.LOAD_QUESTIONS)
    }
}
