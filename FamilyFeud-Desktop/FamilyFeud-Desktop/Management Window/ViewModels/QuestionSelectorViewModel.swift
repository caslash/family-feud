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
    private var windowcontroller: ManagementWindowController
    
    private var game: FamilyFeudGame
    
    public var viewstateservice: ViewStateService
    
    public var questions: QuestionSet {
        self.game.getQuestionSet()
    }
    
    public var multiplier: Int = 1
    
    public var selectedQuestionId: Question.ID?
    
    init(game: FamilyFeudGame, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.game = game
        self.viewstateservice = viewstateservice
        self.windowcontroller = windowcontroller
    }
    
    public func select() {
        if let selectedQuestionId {
            if (self.game.getState().executeAction(action: StatePlay.ACTION_EXECUTEPLAYACTION, data: [
                StateSelectQuestion.ACTION_SELECTQUESTION,
                self.questions.getQuestionIndex(selectedQuestionId),
                self.multiplier
            ])) {
                self.selectedQuestionId = nil
            }
        }
    }
}
