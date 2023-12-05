//
//  QuestionSelectorViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/3/23.
//

import FeudKit
import Foundation
import Observation

@Observable
class QuestionSelectorViewModel {
    private var game: FamilyFeudGame
    
    public var questions: QuestionSet {
        self.game.getQuestionSet()
    }
    
    init(game: FamilyFeudGame) {
        self.game = game
    }
}
