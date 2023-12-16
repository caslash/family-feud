//
//  QuestionSelectorViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/3/23.
//

import FeudKit
import Foundation
import SwiftUI

class QuestionSelectorViewModel: ObservableObject {
    @ObservedObject public var matchmanager: MatchManager
    @ObservedObject public var windowcontroller: ManagementWindowController
    @ObservedObject public var viewstateservice: ViewStateService
    
    public var questions: QuestionSet {
        if let game = self.matchmanager.game {
            return game.getQuestionSet()
        } else {
            return QuestionSet()
        }
    }
    
    public var multiplier: Int = 1
    
    public var selectedQuestionId: Question.ID?
    
    init(matchmanager: MatchManager, windowcontroller: ManagementWindowController, viewstateservice: ViewStateService) {
        self.matchmanager = matchmanager
        self.windowcontroller = windowcontroller
        self.viewstateservice = viewstateservice
    }
    
    public func select() {
        if let game = self.matchmanager.game {
            if let selectedQuestionId {
                if (game.getState().executeAction(action: StatePlay.ACTION_EXECUTEPLAYACTION, data: [
                    StateSelectQuestion.ACTION_SELECTQUESTION,
                    self.questions.getQuestionIndex(selectedQuestionId),
                    self.multiplier
                ])) {
                    self.selectedQuestionId = nil
                }
            }
        }
    }
}
